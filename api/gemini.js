
import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, // Limite absoluto da Vercel (Pro/Hobby pode variar, 60s é o teto seguro)
};

export default async function handler(request, response) {
  // CORS Headers
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();

    // --- 1. COLETA DE CHAVES ---
    const allKeys = [];
    if (process.env.API_KEY) allKeys.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API);

    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.trim().length > 20) { 
            allKeys.push(val.trim());
        }
    }

    const validKeys = [...new Set(allKeys)].filter(k => k && !k.startsWith('vck_') && !k.includes('YOUR_API'));

    if (validKeys.length === 0) {
         return response.status(500).json({ error: 'SERVER CONFIG ERROR: Nenhuma chave de API válida encontrada.' });
    }

    // --- 2. PREPARAÇÃO DO BODY E MODO DE OPERAÇÃO ---
    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return response.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { prompt, schema, isLongOutput } = body || {};
    
    // SISTEMÁTICA DE TEMPO:
    // Se for EBD (isLongOutput), damos 55s (quase estourando a Vercel) para garantir que a IA termine.
    // Se for Versículo, damos 20s para ser ágil e rotacionar rápido se travar.
    const TIMEOUT_MS = isLongOutput ? 55000 : 20000; 

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 3. LOOP DE REVEZAMENTO INTELIGENTE ---
    // Embaralha as chaves
    const shuffledKeys = [...validKeys];
    for (let i = shuffledKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
    }
    
    let lastError = null;
    let successResponse = null;
    let attempts = 0;
    
    // Se for tarefa longa, tentamos menos chaves porque cada tentativa gasta muito tempo
    const maxAttempts = isLongOutput ? 2 : 3;
    const selectedKeys = shuffledKeys.slice(0, maxAttempts);

    for (const apiKey of selectedKeys) {
        // Se já passou de 50s de execução total, a Vercel vai matar o processo em breve.
        // Melhor parar e retornar erro do que deixar a Vercel cortar bruscamente.
        if (Date.now() - startTime > 50000) {
            console.log("Tempo limite da função (Vercel) atingido. Abortando.");
            break; 
        }

        attempts++;
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            const modelId = "gemini-2.5-flash"; 

            const aiConfig = {
                temperature: isLongOutput ? 0.8 : 0.7, // Mais criativo para textos longos
                topP: 0.95,
                topK: 40,
            };

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            const generatePromise = ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("TIMEOUT_KEY_RETRY")), TIMEOUT_MS)
            );

            const aiResponse = await Promise.race([generatePromise, timeoutPromise]);

            if (!aiResponse.text) {
                throw new Error("EMPTY_RESPONSE");
            }

            successResponse = aiResponse.text;
            break; // SUCESSO

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            console.log(`Tentativa ${attempts} falhou (${isLongOutput ? 'Long' : 'Short'}): ${msg}`);

            // Se for tarefa longa e deu TIMEOUT, não adianta tentar outra chave correndo, 
            // pois o tempo da Vercel já foi quase todo gasto.
            if (isLongOutput && msg.includes('TIMEOUT_KEY_RETRY')) {
                break; // Sai do loop e reporta erro para o usuário tentar de novo manualmente
            }

            // Se for erro rápido (429/503), espera um pouco e tenta a próxima chave
            if (msg.includes('503') || msg.includes('429') || msg.includes('Overloaded')) {
                await new Promise(r => setTimeout(r, 2000));
            }
            
            continue; 
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        
        if (errorMsg.includes('TIMEOUT_KEY_RETRY') && isLongOutput) {
             return response.status(504).json({ 
                error: 'O conteúdo é muito complexo e o servidor demorou para responder. Por favor, tente novamente (isso acontece com estudos profundos).' 
            });
        }

        if (errorMsg.includes('503') || errorMsg.includes('Overloaded')) {
             return response.status(503).json({ 
                error: 'Servidores do Google sobrecarregados. Aguarde 30s e tente novamente.' 
            });
        }

        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'Todas as chaves de API estão ocupadas no momento.' 
            });
        }
        
        return response.status(500).json({ 
            error: `Não foi possível gerar. Tente novamente.` 
        });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno.' });
  }
}

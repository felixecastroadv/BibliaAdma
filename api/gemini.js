
import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, // Tempo máximo absoluto da Vercel
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

    // --- 1. COLETA ROBUSTA DE CHAVES (POOL) ---
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

    // --- 2. PREPARAÇÃO DO BODY ---
    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return response.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { prompt, schema } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 3. LOOP DE REVEZAMENTO OTIMIZADO (Qualidade > Quantidade) ---
    // Embaralha as chaves
    const shuffledKeys = [...validKeys];
    for (let i = shuffledKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
    }
    
    let lastError = null;
    let successResponse = null;
    let attempts = 0;
    
    // IMPORTANTE: Limita a 3 tentativas robustas para caber nos 60s da Vercel
    // (3 tentativas x 18s de média = 54s). Tentar 18 chaves causaria timeout da função.
    const maxAttempts = Math.min(3, shuffledKeys.length); 
    const selectedKeys = shuffledKeys.slice(0, maxAttempts);

    for (const apiKey of selectedKeys) {
        // Verificação de segurança de tempo total (Vercel mata com 60s)
        if (Date.now() - startTime > 50000) {
            console.log("Tempo limite da função aproximando-se. Abortando retries.");
            break; 
        }

        attempts++;
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Se falhou antes com 503, tenta o modelo 'flash-lite' ou mantém 'flash'
            // O modelo 2.5 flash é o mais rápido, mantemos ele.
            const modelId = "gemini-2.5-flash"; 

            const aiConfig = {
                temperature: 0.7, 
                topP: 0.95,
                topK: 40,
            };

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            // AUMENTADO PARA 25 SEGUNDOS (O Google está demorando quando sobrecarregado)
            const TIMEOUT_MS = 25000; 

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
            console.log(`Tentativa ${attempts} falhou: ${msg}`);

            // Se for erro de servidor (503) ou Cota (429), dá uma pequena pausa antes da próxima chave
            if (msg.includes('503') || msg.includes('429') || msg.includes('Overloaded')) {
                await new Promise(r => setTimeout(r, 2000)); // Espera 2s para o servidor respirar
            }
            
            // Continua para a próxima chave do loop
            continue; 
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        
        // Mensagem amigável para o usuário final
        if (errorMsg.includes('503') || errorMsg.includes('Overloaded')) {
             return response.status(503).json({ 
                error: 'Instabilidade momentânea nos servidores do Google (IA Sobrecarregada). Tente novamente em 30 segundos.' 
            });
        }

        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'Alto tráfego. Todas as chaves disponíveis estão ocupadas no momento.' 
            });
        }
        
        return response.status(500).json({ 
            error: `Falha após ${attempts} tentativas. Último erro: ${errorMsg}` 
        });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico.' });
  }
}

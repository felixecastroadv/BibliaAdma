
import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
// Aumentamos para 300 (5 min) para contas Pro. Contas Hobby ficam limitadas a 10s ou 60s automaticamente.
export const config = {
  maxDuration: 300, 
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
    // Se for EBD (isLongOutput), definimos como 0 (SEM LIMITE ARTIFICIAL). Deixamos a IA rodar até acabar ou o Vercel cortar.
    // Se for Chat/Versículo, mantemos 20s para garantir agilidade na rotação se travar.
    const TIMEOUT_MS = isLongOutput ? 0 : 20000; 

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 3. LOOP DE REVEZAMENTO ---
    const shuffledKeys = [...validKeys];
    // Embaralha
    for (let i = shuffledKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
    }
    
    let lastError = null;
    let successResponse = null;
    let attempts = 0;
    
    // Se for Long Output, tentamos menos vezes para não estourar o tempo total da requisição HTTP do cliente
    const maxAttempts = isLongOutput ? 2 : 3;
    const selectedKeys = shuffledKeys.slice(0, maxAttempts);

    for (const apiKey of selectedKeys) {
        attempts++;
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            // Flash é rápido e suporta contexto longo.
            const modelId = "gemini-2.5-flash"; 

            const aiConfig = {
                temperature: isLongOutput ? 0.8 : 0.7,
                topP: 0.95,
                topK: 40,
                // Garante que o modelo saiba que pode gerar muito texto se for longo
                maxOutputTokens: isLongOutput ? 8192 : 2048, 
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

            let aiResponse;

            if (TIMEOUT_MS > 0) {
                // Modo Rápido (Com Timeout para rotação ágil)
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("TIMEOUT_KEY_RETRY")), TIMEOUT_MS)
                );
                aiResponse = await Promise.race([generatePromise, timeoutPromise]);
            } else {
                // Modo Livre (Panorama): Espera a IA terminar, sem cronômetro.
                // Só sai daqui se a API do Google responder ou der erro real.
                aiResponse = await generatePromise;
            }

            if (!aiResponse.text) {
                throw new Error("EMPTY_RESPONSE");
            }

            successResponse = aiResponse.text;
            break; // SUCESSO!

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            console.log(`Tentativa ${attempts} falhou: ${msg}`);

            // Se for erro de Cota (429) ou Sobrecarga (503), tentamos a próxima chave.
            // Se for outro erro (ex: prompt inválido), o loop continua também.
            if (msg.includes('503') || msg.includes('429') || msg.includes('Overloaded')) {
                // Pequena pausa para não bater na próxima chave instantaneamente
                await new Promise(r => setTimeout(r, 1000));
            }
            
            continue; 
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        
        // Mensagens mais claras para o Frontend
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'Limite de cotas atingido em todas as chaves disponíveis. Tente mais tarde.' 
            });
        }
        
        if (errorMsg.includes('503') || errorMsg.includes('Overloaded')) {
             return response.status(503).json({ 
                error: 'Servidores do Google sobrecarregados momentaneamente.' 
            });
        }

        return response.status(500).json({ 
            error: `Não foi possível gerar o conteúdo. Detalhe: ${errorMsg}` 
        });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico.' });
  }
}

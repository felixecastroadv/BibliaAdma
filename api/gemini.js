
import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, // Tempo máximo de execução (segundos)
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
    // --- 1. COLETA ROBUSTA DE CHAVES (POOL) ---
    const allKeys = [];

    // Adiciona chaves principais se existirem
    if (process.env.API_KEY) allKeys.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API);

    // Adiciona chaves numeradas (API_KEY_1 ... API_KEY_50)
    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.trim().length > 20) { 
            allKeys.push(val.trim());
        }
    }

    // Filtra chaves válidas e remove duplicatas
    const validKeys = [...new Set(allKeys)].filter(k => k && !k.startsWith('vck_') && !k.includes('YOUR_API'));

    if (validKeys.length === 0) {
         return response.status(500).json({ 
             error: 'SERVER CONFIG ERROR: Nenhuma chave de API válida encontrada.' 
         });
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

    // --- 3. LOOP DE REVEZAMENTO OTIMIZADO (Load Balancer) ---
    // Algoritmo Fisher-Yates Shuffle para garantir aleatoriedade real na escolha da chave
    const shuffledKeys = [...validKeys];
    for (let i = shuffledKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledKeys[i], shuffledKeys[j]] = [shuffledKeys[j], shuffledKeys[i]];
    }
    
    let lastError = null;
    let successResponse = null;
    let attempts = 0;

    // Tenta cada chave da lista embaralhada
    for (const apiKey of shuffledKeys) {
        attempts++;
        
        try {
            const ai = new GoogleGenAI({ apiKey });
            const modelId = "gemini-2.5-flash"; // Modelo padrão rápido e eficiente

            const aiConfig = {
                temperature: 0.5, 
                topP: 0.95,
                topK: 40,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
            };

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            // Implementa Timeout por Tentativa (12s) para não travar o loop se uma chave congelar
            const generatePromise = ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("TIMEOUT_KEY_RETRY")), 12000)
            );

            const aiResponse = await Promise.race([generatePromise, timeoutPromise]);

            if (!aiResponse.text) {
                throw new Error("EMPTY_RESPONSE");
            }

            successResponse = aiResponse.text;
            break; // SUCESSO - Interrompe o loop

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            
            // Verificações de erro para decidir se tenta a próxima chave
            const isQuota = msg.includes('429') || msg.includes('Quota') || msg.includes('Exhausted') || msg.includes('Too Many Requests');
            const isServer = msg.includes('503') || msg.includes('500') || msg.includes('Overloaded');
            const isTimeout = msg.includes('TIMEOUT_KEY_RETRY') || msg.includes('fetch failed');
            const isKeyError = msg.includes('API key not valid') || msg.includes('API_KEY_INVALID');

            // Se for erro de limite, servidor, rede ou chave inválida -> TENTA A PRÓXIMA
            if (isQuota || isServer || isTimeout || isKeyError) {
                continue; 
            } else {
                // Erros de lógica (400 Bad Request, etc) não adiantam trocar a chave
                break; 
            }
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'TRÁFEGO INTENSO: Todas as chaves de API estão ocupadas no momento. Tente novamente em 1 minuto.' 
            });
        }
        
        return response.status(500).json({ 
            error: `Não foi possível gerar conteúdo após ${attempts} tentativas. Detalhe: ${errorMsg}` 
        });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno no servidor de IA.' });
  }
}

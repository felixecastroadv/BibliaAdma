
import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, // Tempo máximo de execução (segundos)
};

export default async function handler(request, response) {
  // Configuração de CORS
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
    // --- 1. COLETA MASSIVA DE CHAVES (POOL) ---
    const allKeys = [];

    if (process.env.API_KEY) allKeys.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API);

    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.length > 10) {
            allKeys.push(val);
        }
    }

    const validKeys = [...new Set(allKeys)].filter(k => k && !k.startsWith('vck_'));

    if (validKeys.length === 0) {
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada (API_KEY_1...50).' 
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

    // --- 3. LOOP DE ROTAÇÃO DE CHAVES (FAILOVER INTELIGENTE) ---
    const shuffledKeys = validKeys.sort(() => 0.5 - Math.random());
    
    let lastError = null;
    let successResponse = null;
    let attempts = 0;

    for (const apiKey of shuffledKeys) {
        attempts++;
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const modelId = "gemini-2.5-flash"; 

            // Configuração otimizada para velocidade
            const aiConfig = {
                temperature: 0.4, // Mais baixo = Mais rápido e determinístico
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

            const aiResponse = await ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) {
                throw new Error(aiResponse.candidates?.[0]?.finishReason || "EMPTY_RESPONSE_RETRY");
            }

            successResponse = aiResponse.text;
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            
            const isQuotaError = msg.includes('429') || msg.includes('Quota') || msg.includes('Too Many Requests') || msg.includes('Exhausted');
            const isServerError = msg.includes('503') || msg.includes('500') || msg.includes('Overloaded') || msg.includes('EMPTY_RESPONSE');

            if (isQuotaError || isServerError) {
                continue; 
            } else {
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
                error: 'SISTEMA SOBRECARREGADO: Todas as chaves de API atingiram o limite simultaneamente. Tente novamente em 2 minutos.' 
            });
        }
        
        return response.status(500).json({ error: `Erro na geração: ${errorMsg}` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor.' });
  }
}

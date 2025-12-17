
import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, 
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
    // --- 1. COLETA E ORDENAÇÃO SEQUENCIAL DE CHAVES ---
    const allKeys = [];

    if (process.env.API_KEY) allKeys.push({ k: process.env.API_KEY, i: 0 });
    if (process.env.Biblia_ADMA_API) allKeys.push({ k: process.env.Biblia_ADMA_API, i: 0.1 });

    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.length > 10 && !val.startsWith('vck_')) {
            allKeys.push({ k: val, i: i });
        }
    }

    if (allKeys.length === 0) {
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada.' 
         });
    }

    const sortedKeys = allKeys.sort((a, b) => a.i - b.i).map(item => item.k);

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

    let lastError = null;
    let successResponse = null;
    const keysToTry = sortedKeys.slice(0, 15);

    for (const apiKey of keysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // @google/genai: Use gemini-3-flash-preview for text tasks and ensure thinkingBudget is set alongside maxOutputTokens.
            const aiConfig = {
                temperature: 0.5, 
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 4096, 
                thinkingConfig: { thinkingBudget: 2048 },
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
                model: "gemini-3-flash-preview",
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) {
                throw new Error("Resposta vazia da IA (Retry)");
            }

            successResponse = aiResponse.text;
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
                return response.status(400).json({ error: `Erro no formato da requisição: ${msg}` });
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'SISTEMA OCUPADO: As primeiras chaves estão congestionadas. Aguarde 30 segundos.' 
            });
        }
        return response.status(500).json({ error: `Falha na geração: ${errorMsg}` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor.' });
  }
}

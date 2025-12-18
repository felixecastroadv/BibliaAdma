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
         return response.status(500).json({ error: 'Nenhuma Chave de API configurada.' });
    }

    const sortedKeys = allKeys.sort((a, b) => a.i - b.i).map(item => item.k);

    // --- 2. PREPARAÇÃO DO BODY ---
    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { return response.status(400).json({ error: 'Invalid JSON body' }); }
    }
    const { prompt, schema, isLongOutput, taskType } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 3. SELEÇÃO DE MODELO E CONFIG ---
    // EBD e Comentários exigem o PRO para maior profundidade e seguimento de instruções
    const isHighQuality = taskType === 'ebd' || taskType === 'commentary';
    const modelId = isHighQuality ? "gemini-3-pro-preview" : "gemini-3-flash-preview";
    
    let lastError = null;
    let successResponse = null;
    const keysToTry = sortedKeys.slice(0, 15);

    for (const apiKey of keysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const aiConfig = {
                temperature: isHighQuality ? 0.8 : 0.5, 
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
            };

            // Adiciona Thinking Budget para tarefas complexas
            if (isHighQuality) {
                aiConfig.thinkingConfig = { thinkingBudget: 4000 };
            }

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            // MODO STREAMING PARA CONTEÚDOS LONGOS (EBD)
            if (isLongOutput && !schema) {
                const streamResponse = await ai.models.generateContentStream({
                    model: modelId,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: aiConfig
                });

                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                for await (const chunk of streamResponse) {
                    if (chunk.text) response.write(chunk.text);
                }
                return response.end();
            }

            const aiResponse = await ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) throw new Error("Resposta vazia");

            successResponse = aiResponse.text;
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            if (msg.includes('400')) return response.status(400).json({ error: `Erro de formato: ${msg}` });
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        return response.status(500).json({ error: lastError?.message || 'Falha na geração.' });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico.' });
  }
}
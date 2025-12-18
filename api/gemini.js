import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60,
};

export default async function handler(request, response) {
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
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada.' 
         });
    }

    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return response.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { prompt, schema, isLongOutput, taskType } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    const shuffledKeys = validKeys.sort(() => 0.5 - Math.random());
    let lastError = null;

    // Determine model and thinking config based on task complexity
    const isComplex = taskType === 'ebd' || taskType === 'commentary';
    const modelId = isComplex ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    for (const apiKey of shuffledKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const aiConfig = {
                temperature: isComplex ? 0.8 : 0.7,
                topP: 0.95,
                topK: 40,
            };

            // Use thinking budget for complex theological exegesis to ensure depth
            if (isComplex) {
                aiConfig.thinkingConfig = { thinkingBudget: 4000 };
            }

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            // TRUE STREAMING FOR LONG OUTPUTS
            if (isLongOutput && !schema) {
                const streamResponse = await ai.models.generateContentStream({
                    model: modelId,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: aiConfig
                });

                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Transfer-Encoding', 'chunked');

                for await (const chunk of streamResponse) {
                    if (chunk.text) {
                        response.write(chunk.text);
                    }
                }
                return response.end();
            }

            // STANDARD JSON RESPONSE
            const aiResponse = await ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) {
                throw new Error("EMPTY_RESPONSE_RETRY");
            }

            return response.status(200).json({ text: aiResponse.text });

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            const isQuotaError = msg.includes('429') || msg.includes('Quota') || msg.includes('Too Many Requests');
            if (isQuotaError) continue; else break;
        }
    }

    return response.status(500).json({ error: lastError?.message || 'Erro na geração.' });
  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico.' });
  }
}

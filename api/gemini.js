import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60,
  supportsResponseStreaming: true, 
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }
    const { prompt, schema, isLongOutput } = body || {};

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let allKeys = [];
    for (let i = 1; i <= 50; i++) {
        const val = process.env[`API_KEY_${i}`];
        if (val && val.trim().length > 20) allKeys.push(val.trim());
    }
    if (process.env.API_KEY) allKeys.push(process.env.API_KEY.trim());
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API.trim());
    allKeys = [...new Set(allKeys)];

    if (allKeys.length === 0) return response.status(500).json({ error: 'Nenhuma chave de API configurada.' });

    const startIndex = Math.floor(Math.random() * allKeys.length);
    const PRIMARY_MODEL = "gemini-2.5-flash";
    const BACKUP_MODEL = "gemini-1.5-flash";

    let successResponse = null;
    let lastError = null;
    const MAX_ATTEMPTS = Math.min(allKeys.length, 15);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const keyIndex = (startIndex + i) % allKeys.length;
        const apiKey = allKeys[keyIndex];
        const currentModel = i < 3 ? PRIMARY_MODEL : BACKUP_MODEL;

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            if (isLongOutput && !schema) {
                const streamResult = await ai.models.generateContentStream({
                    model: currentModel,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: { temperature: 0.7, topP: 0.95, maxOutputTokens: 8192 }
                });

                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Transfer-Encoding', 'chunked');

                for await (const chunk of streamResult) {
                    if (chunk.text) response.write(chunk.text);
                }
                response.end();
                return;
            } else {
                const config = { temperature: 0.6 };
                if (schema) {
                    config.responseMimeType = "application/json";
                    config.responseSchema = schema;
                }
                const result = await ai.models.generateContent({
                    model: currentModel,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: config
                });
                successResponse = result.text;
                break;
            }
        } catch (error) {
            lastError = error;
            if (error.message.includes('429') || error.message.includes('Quota')) continue;
            await delay(300);
        }
    }

    if (successResponse) return response.status(200).json({ text: successResponse });
    return response.status(503).json({ error: `Servidores ocupados. (${lastError?.message})` });

  } catch (error) {
    return response.status(500).json({ error: `Erro Interno: ${error.message}` });
  }
}
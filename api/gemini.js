
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, 
  supportsResponseStreaming: true, // Habilita streaming no Vercel
};

export default async function handler(request, response) {
  // Headers para suportar Streaming e CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Coleta de Chaves
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

    // Escolhe uma chave aleatória (sem rotação complexa no streaming para evitar falhas parciais)
    const randomKey = validKeys[Math.floor(Math.random() * validKeys.length)];

    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }
    const { prompt, schema, isLongOutput } = body || {};

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- MODO STREAMING (Para Panorama/EBD) ---
    // Mantém a conexão viva enviando chunks, evitando timeout de 10s/60s do Gateway
    if (isLongOutput && !schema) {
        try {
            const ai = new GoogleGenAI({ apiKey: randomKey });
            const modelId = "gemini-2.5-flash"; 

            const aiConfig = {
                temperature: 0.8,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192,
            };

            // Gera stream
            const result = await ai.models.generateContentStream({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            // Configura headers para SSE/Streaming
            response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            response.setHeader('Transfer-Encoding', 'chunked');

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                    response.write(chunkText);
                }
            }
            
            response.end();
            return;

        } catch (streamError) {
            console.error("Stream Error:", streamError);
            // Se falhar no meio do stream, não tem como enviar JSON de erro limpo, pois headers já foram.
            // Encerra a resposta.
            response.end(); 
            return;
        }
    }

    // --- MODO PADRÃO (JSON Único) ---
    // Para Chat, Dicionário e coisas curtas/estruturadas
    try {
        const ai = new GoogleGenAI({ apiKey: randomKey });
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

        const result = await ai.models.generateContent({
            model: modelId,
            contents: [{ parts: [{ text: prompt }] }],
            config: aiConfig
        });
        
        return response.status(200).json({ text: result.response.text() });

    } catch (error) {
        const msg = error.message || '';
        if (msg.includes('429')) {
             return response.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
        }
        return response.status(500).json({ error: `Erro na geração: ${msg}` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico.' });
  }
}

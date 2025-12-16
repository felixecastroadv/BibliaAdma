
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

    // Embaralha chaves para balanceamento
    const shuffledKeys = [...validKeys].sort(() => 0.5 - Math.random());

    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }
    const { prompt, schema, isLongOutput } = body || {};

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- MODO STREAMING (Para Panorama/EBD) ---
    // Agora com Rotação de Chaves (Retry)
    if (isLongOutput && !schema) {
        let lastError = null;
        // Tenta até 3 chaves diferentes para garantir a entrega
        const keysToTry = shuffledKeys.slice(0, 3);

        for (const apiKey of keysToTry) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                const modelId = "gemini-2.5-flash"; 

                const aiConfig = {
                    temperature: 0.8,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 8192,
                };

                // Inicia o stream (Essa é a parte que costuma falhar se a chave estiver ruim)
                const result = await ai.models.generateContentStream({
                    model: modelId,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: aiConfig
                });

                // Se chegou aqui, a conexão foi aceita! 
                // Agora podemos enviar os headers de sucesso.
                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Transfer-Encoding', 'chunked');

                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        response.write(chunkText);
                    }
                }
                
                response.end();
                return; // Sucesso total, encerra a função.

            } catch (streamError) {
                console.error("Stream Error (Retry):", streamError.message);
                lastError = streamError;

                // Se os headers já foram enviados (falhou no meio do texto), não tem como voltar atrás.
                // O cliente vai receber texto incompleto, mas não tem como enviar JSON de erro agora.
                if (response.headersSent) {
                    response.end(); 
                    return; 
                }
                
                // Se headers NÃO foram enviados, tentamos a próxima chave no loop...
                await new Promise(r => setTimeout(r, 1000)); // Pequena pausa
            }
        }

        // Se saiu do loop, todas as tentativas falharam.
        // Como headers não foram enviados, podemos retornar um JSON de erro limpo.
        const msg = lastError?.message || 'Erro desconhecido';
        if (msg.includes('429') || msg.includes('Quota')) {
            return response.status(429).json({ error: 'Todas as chaves de API estão ocupadas no momento. Tente em 1 minuto.' });
        }
        return response.status(500).json({ error: `Falha na geração: ${msg}` });
    }

    // --- MODO PADRÃO (JSON Único) ---
    // Para Chat, Dicionário e coisas curtas
    // Também implementa rotação simplificada
    let successResponse = null;
    let lastError = null;
    const shortKeysToTry = shuffledKeys.slice(0, 3);

    for (const apiKey of shortKeysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey });
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
            
            successResponse = result.response.text();
            break; // Sucesso

        } catch (error) {
            lastError = error;
            if (error.message.includes('429')) await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const msg = lastError?.message || '';
        if (msg.includes('429')) {
             return response.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
        }
        return response.status(500).json({ error: `Erro na geração: ${msg}` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico.' });
  }
}

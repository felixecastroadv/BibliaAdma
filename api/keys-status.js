import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, // Limite Vercel Hobby
};

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. COLETAR CHAVES
    const allKeys = [];
    if (process.env.API_KEY) allKeys.push({ name: 'MAIN_KEY', key: process.env.API_KEY });
    if (process.env.Biblia_ADMA_API) allKeys.push({ name: 'ADMA_KEY', key: process.env.Biblia_ADMA_API });

    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.trim().length > 20) { 
            allKeys.push({ name: keyName, key: val.trim() });
        }
    }

    // Remove duplicatas
    const uniqueKeys = [];
    const seen = new Set();
    for (const k of allKeys) {
        if (!seen.has(k.key)) {
            seen.add(k.key);
            uniqueKeys.push(k);
        }
    }

    if (uniqueKeys.length === 0) {
        return response.status(200).json({ keys: [], total: 0, healthy: 0 });
    }

    // 2. FUNÇÃO DE TESTE INDIVIDUAL (FAILOVER INTELIGENTE)
    const checkKey = async (keyEntry) => {
        const start = Date.now();
        let usedModel = "gemini-2.5-flash";

        try {
            const ai = new GoogleGenAI({ apiKey: keyEntry.key });
            
            // Função auxiliar de chamada com configurações permissivas
            const performCall = async (modelName) => {
                return await ai.models.generateContent({
                    model: modelName,
                    contents: [{ parts: [{ text: "Hello" }] }],
                    config: { 
                        maxOutputTokens: 30, 
                        temperature: 0.1,
                        safetySettings: [
                            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                        ]
                    } 
                });
            };

            let result;
            try {
                result = await performCall("gemini-2.5-flash");
            } catch (errPrimary) {
                const msg = errPrimary.message || JSON.stringify(errPrimary);
                if (msg.includes("404") || msg.includes("not found") || msg.includes("model")) {
                    usedModel = "gemini-1.5-flash";
                    result = await performCall("gemini-1.5-flash");
                } else {
                    throw errPrimary;
                }
            }

            // Validação de integridade
            let textOutput = result?.text;
            if (!textOutput) {
                textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            }

            if (!textOutput) {
                throw new Error("Resposta vazia (Sem texto)");
            }

            return {
                name: keyEntry.name,
                mask: `...${keyEntry.key.slice(-4)}`,
                status: 'active',
                latency: Date.now() - start,
                msg: 'OK',
                model: usedModel
            };

        } catch (e) {
            const err = e.message || JSON.stringify(e);
            let status = 'error';
            let msg = err.substring(0, 60);

            if (err.includes('429') || err.includes('Quota') || err.includes('Exhausted')) {
                status = 'exhausted';
                msg = 'Cota Excedida (429)';
            } else if (err.includes('API key not valid') || err.includes('400') || err.includes('INVALID_ARGUMENT')) {
                status = 'invalid';
                msg = 'Chave Inválida';
            } else if (err.includes('503') || err.includes('Overloaded')) {
                status = 'slow';
                msg = 'Google Instável (503)';
            } else if (err.includes('404') || err.includes('not found')) {
                status = 'error';
                msg = 'Modelo 404';
            } else if (err.includes('fetch failed')) {
                status = 'error';
                msg = 'Erro de Conexão';
            }

            return {
                name: keyEntry.name,
                mask: `...${keyEntry.key.slice(-4)}`,
                status,
                latency: Date.now() - start,
                msg
            };
        }
    };

    // 3. PROCESSAMENTO EM LOTES (BATCH)
    const BATCH_SIZE = 5;
    const finalResults = [];

    for (let i = 0; i < uniqueKeys.length; i += BATCH_SIZE) {
        const batch = uniqueKeys.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(k => checkKey(k)));
        finalResults.push(...batchResults);
        
        if (i + BATCH_SIZE < uniqueKeys.length) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    const healthyCount = finalResults.filter(r => r.status === 'active').length;

    return response.status(200).json({
        keys: finalResults,
        total: finalResults.length,
        healthy: healthyCount,
        healthPercentage: finalResults.length > 0 ? Math.round((healthyCount / finalResults.length) * 100) : 0
    });

  } catch (error) {
    console.error("Monitor Error:", error);
    return response.status(500).json({ error: 'Erro crítico no monitoramento.' });
  }
}
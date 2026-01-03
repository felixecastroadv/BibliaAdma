
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60,
};

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // The API key must be obtained exclusively from the environment variable process.env.API_KEY.
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        return response.status(200).json({ keys: [], total: 0, healthy: 0 });
    }

    const checkKey = async (name, key) => {
        const start = Date.now();
        let usedModel = "gemini-3-flash-preview";

        try {
            // Always initialize right before use.
            const ai = new GoogleGenAI({ apiKey: key });
            
            // Perform a minimal check call to verify key health.
            const result = await ai.models.generateContent({
                model: usedModel,
                contents: [{ parts: [{ text: "Hello" }] }],
                config: { 
                    maxOutputTokens: 30,
                    // If maxOutputTokens is set, thinkingBudget must also be set.
                    thinkingConfig: { thinkingBudget: 15 },
                    temperature: 0.1
                } 
            });

            const textOutput = result?.text;
            if (!textOutput) {
                throw new Error("Resposta vazia (Sem texto)");
            }

            return {
                name: name,
                mask: `...${key.slice(-4)}`,
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
            } else if (err.includes('API key not valid') || err.includes('400')) {
                status = 'invalid';
                msg = 'Chave Inválida';
            } else if (err.includes('503') || err.includes('Overloaded')) {
                status = 'slow';
                msg = 'Google Instável (503)';
            }

            return {
                name: name,
                mask: `...${key.slice(-4)}`,
                status,
                latency: Date.now() - start,
                msg
            };
        }
    };

    const result = await checkKey('MAIN_KEY', apiKey);
    const finalResults = [result];
    const healthyCount = result.status === 'active' ? 1 : 0;

    return response.status(200).json({
        keys: finalResults,
        total: 1,
        healthy: healthyCount,
        healthPercentage: healthyCount === 1 ? 100 : 0
    });

  } catch (error) {
    console.error("Monitor Error:", error);
    return response.status(500).json({ error: 'Erro crítico no monitoramento.' });
  }
}

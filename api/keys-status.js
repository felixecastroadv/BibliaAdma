import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60,
};

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawKeys = [
        { name: 'MAIN_KEY', key: process.env.API_KEY },
        { name: 'ADMA_KEY', key: process.env.Biblia_ADMA_API },
        { name: 'API_KEY_1', key: process.env.API_KEY_1 },
        { name: 'API_KEY_2', key: process.env.API_KEY_2 },
        { name: 'API_KEY_3', key: process.env.API_KEY_3 },
        { name: 'API_KEY_4', key: process.env.API_KEY_4 },
        { name: 'API_KEY_5', key: process.env.API_KEY_5 },
        { name: 'API_KEY_6', key: process.env.API_KEY_6 },
        { name: 'API_KEY_7', key: process.env.API_KEY_7 },
        { name: 'API_KEY_8', key: process.env.API_KEY_8 },
        { name: 'API_KEY_9', key: process.env.API_KEY_9 },
        { name: 'API_KEY_10', key: process.env.API_KEY_10 },
        { name: 'API_KEY_11', key: process.env.API_KEY_11 },
        { name: 'API_KEY_12', key: process.env.API_KEY_12 },
        { name: 'API_KEY_13', key: process.env.API_KEY_13 },
        { name: 'API_KEY_14', key: process.env.API_KEY_14 },
        { name: 'API_KEY_15', key: process.env.API_KEY_15 },
        { name: 'API_KEY_16', key: process.env.API_KEY_16 },
        { name: 'API_KEY_17', key: process.env.API_KEY_17 },
        { name: 'API_KEY_18', key: process.env.API_KEY_18 },
        { name: 'API_KEY_19', key: process.env.API_KEY_19 },
        { name: 'API_KEY_20', key: process.env.API_KEY_20 },
        { name: 'API_KEY_21', key: process.env.API_KEY_21 }
    ];

    const activeKeysConfigured = rawKeys.filter(k => k.key && k.key.trim().length > 10);

    if (activeKeysConfigured.length === 0) {
        return response.status(200).json({ keys: [], total: 0, healthy: 0, healthPercentage: 0 });
    }

    const checkKey = async (keyEntry) => {
        const start = Date.now();
        try {
            const ai = new GoogleGenAI({ apiKey: keyEntry.key });
            
            // TESTE REAL COM O MODELO PRO (Igual ao App)
            const result = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: [{ parts: [{ text: "Responda apenas: Ativa" }] }],
                config: { 
                    maxOutputTokens: 5,
                    thinkingConfig: { thinkingBudget: 0 }
                } 
            });

            if (!result?.text) throw new Error("Sem resposta");

            return {
                name: keyEntry.name,
                mask: `...${keyEntry.key.slice(-4)}`,
                status: 'active',
                latency: Date.now() - start,
                msg: 'OK'
            };

        } catch (e) {
            const err = e.message || "";
            let status = 'error';
            let msg = 'Erro';

            if (err.includes('429') || err.includes('Quota') || err.includes('limit')) {
                status = 'exhausted';
                msg = 'Esgotada (429)';
            } else if (err.includes('API key not valid')) {
                status = 'invalid';
                msg = 'Chave Inválida';
            } else {
                status = 'error';
                msg = err.substring(0, 30);
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

    // Testa em pequenos lotes para não sobrecarregar o próprio servidor
    const results = [];
    for (let i = 0; i < activeKeysConfigured.length; i += 5) {
        const chunk = activeKeysConfigured.slice(i, i + 5);
        const chunkResults = await Promise.all(chunk.map(k => checkKey(k)));
        results.push(...chunkResults);
    }
    
    const healthyCount = results.filter(r => r.status === 'active').length;

    return response.status(200).json({
        keys: results,
        total: activeKeysConfigured.length,
        healthy: healthyCount,
        healthPercentage: Math.round((healthyCount / activeKeysConfigured.length) * 100)
    });

  } catch (error) {
    return response.status(500).json({ error: 'Erro no monitor de infraestrutura.' });
  }
}
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60,
};

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const keysNames = [
        'API_KEY',
        'Biblia_ADMA_API',
        'Biblia_ADMA',
        'API_Biblia_ADMA',
        'BIBLIA_ADMA'
    ];
    // Monitora até 40 chaves para acompanhar seu crescimento na Vercel
    for(let i=1; i<=40; i++) keysNames.push(`API_KEY_${i}`);

    const activeKeysConfigured = keysNames
        .map(name => ({ name, key: process.env[name] }))
        .filter(entry => entry.key && entry.key.trim().length > 15);

    if (activeKeysConfigured.length === 0) {
        return response.status(200).json({ keys: [], total: 0, healthy: 0, healthPercentage: 0 });
    }

    const checkKey = async (keyEntry) => {
        const start = Date.now();
        try {
            const ai = new GoogleGenAI({ apiKey: keyEntry.key });
            const result = await ai.models.generateContent({
                model: "gemini-3-pro-preview",
                contents: [{ parts: [{ text: "ping" }] }],
                config: { 
                    maxOutputTokens: 2,
                    thinkingConfig: { thinkingBudget: 0 }
                } 
            });

            if (!result?.text) throw new Error("Resposta Vazia");

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

            if (err.includes('429') || err.includes('Quota')) {
                status = 'exhausted';
                msg = 'Limite atingido';
            } else if (err.includes('API key not valid') || err.includes('401')) {
                status = 'invalid';
                msg = 'Chave Inválida/Inativa';
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

    // Testa em blocos de 5 para não sobrecarregar
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
    return response.status(500).json({ error: 'Erro ao processar monitor.' });
  }
}

import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60,
};

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Coleta todas as chaves
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

    // Remove duplicatas baseadas no valor da chave
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

    // 2. Testa cada chave (Concorrência limitada para não estourar o servidor)
    const results = await Promise.all(uniqueKeys.map(async (k) => {
        const start = Date.now();
        let status = 'active'; // active, exhausted, error, slow
        let msg = 'OK';

        try {
            const ai = new GoogleGenAI({ apiKey: k.key });
            // Faz uma requisição MÍNIMA para testar a chave (1 token)
            await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ parts: [{ text: "oi" }] }],
                config: { maxOutputTokens: 1 } 
            });
        } catch (e) {
            const err = e.message || '';
            if (err.includes('429') || err.includes('Quota') || err.includes('Exhausted')) {
                status = 'exhausted';
                msg = 'Limite Diário Atingido';
            } else {
                status = 'error';
                msg = err.substring(0, 30);
            }
        }

        const latency = Date.now() - start;
        if (status === 'active' && latency > 2000) status = 'slow';

        return {
            name: k.name,
            mask: `...${k.key.slice(-4)}`,
            status,
            latency,
            msg
        };
    }));

    const healthyCount = results.filter(r => r.status === 'active' || r.status === 'slow').length;

    return response.status(200).json({
        keys: results,
        total: results.length,
        healthy: healthyCount,
        healthPercentage: Math.round((healthyCount / results.length) * 100)
    });

  } catch (error) {
    return response.status(500).json({ error: 'Erro ao verificar chaves.' });
  }
}

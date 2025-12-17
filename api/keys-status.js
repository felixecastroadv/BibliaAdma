
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60,
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

    // OTIMIZAÇÃO: Testar apenas uma AMOSTRA de 5 chaves aleatórias por vez
    // Isso evita que o monitor "mate" todas as chaves ao testá-las simultaneamente.
    const sampleSize = 5;
    const shuffled = uniqueKeys.sort(() => 0.5 - Math.random());
    const selectedKeys = shuffled.slice(0, sampleSize);

    const checkKey = async (keyEntry) => {
        const start = Date.now();
        try {
            const ai = new GoogleGenAI({ apiKey: keyEntry.key });
            
            // @google/genai: Use gemini-3-flash-preview and disable thinking for minimal latency during a simple health check.
            const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: [{ parts: [{ text: "Hi" }] }],
                config: { 
                    maxOutputTokens: 5,
                    thinkingConfig: { thinkingBudget: 0 }
                } 
            });

            if (!result?.text) {
                throw new Error("No text");
            }

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
                msg = 'Cota (429)';
            } else if (err.includes('API key not valid')) {
                status = 'invalid';
                msg = 'Inválida';
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

    const results = await Promise.all(selectedKeys.map(k => checkKey(k)));
    const healthySample = results.filter(r => r.status === 'active').length;
    
    // Extrapolação estatística para exibição
    const estimatedHealthy = Math.round((healthySample / sampleSize) * uniqueKeys.length);

    return response.status(200).json({
        keys: results, // Retorna só a amostra testada
        total: uniqueKeys.length, // Total real de chaves configuradas
        healthy: estimatedHealthy, // Estimativa
        healthPercentage: Math.round((healthySample / sampleSize) * 100),
        note: "Amostragem aleatória de 5 chaves para evitar sobrecarga."
    });

  } catch (error) {
    return response.status(500).json({ error: 'Erro no monitoramento.' });
  }
}

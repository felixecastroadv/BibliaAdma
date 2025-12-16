
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

    // 2. FUNÇÃO DE TESTE INDIVIDUAL (Rigorosa)
    const checkKey = async (keyEntry) => {
        const start = Date.now();
        try {
            const ai = new GoogleGenAI({ apiKey: keyEntry.key });
            
            // Usamos o modelo 1.5-flash pois é o "tanque de guerra". 
            // Se ele falhar, a chave está inutilizável.
            const result = await ai.models.generateContent({
                model: "gemini-1.5-flash",
                contents: [{ parts: [{ text: "Responda OK" }] }],
                config: { 
                    maxOutputTokens: 5,
                    temperature: 0
                } 
            });

            // Validação rigorosa: Se não tem texto, falhou.
            if (!result || !result.text) {
                throw new Error("Resposta vazia (Sem texto)");
            }

            return {
                name: keyEntry.name,
                mask: `...${keyEntry.key.slice(-4)}`,
                status: 'active',
                latency: Date.now() - start,
                msg: 'OK'
            };

        } catch (e) {
            const err = e.message || JSON.stringify(e);
            let status = 'error';
            let msg = err.substring(0, 60);

            if (err.includes('429') || err.includes('Quota') || err.includes('Exhausted') || err.includes('Resource has been exhausted')) {
                status = 'exhausted';
                msg = 'Cota Excedida (429)';
            } else if (err.includes('API key not valid')) {
                msg = 'Chave Inválida';
            } else if (err.includes('503') || err.includes('Overloaded')) {
                status = 'slow';
                msg = 'Google Instável (503)';
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
    // Processar 50 chaves simultâneas derruba a conexão. Vamos de 5 em 5.
    const BATCH_SIZE = 5;
    const finalResults = [];

    for (let i = 0; i < uniqueKeys.length; i += BATCH_SIZE) {
        const batch = uniqueKeys.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(k => checkKey(k)));
        finalResults.push(...batchResults);
        
        // Pequena pausa entre lotes para não ser bloqueado por "flood"
        if (i + BATCH_SIZE < uniqueKeys.length) {
            await new Promise(r => setTimeout(r, 200));
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

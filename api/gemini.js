
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, // Limite padrão da Vercel (evita segurar conexões mortas)
  supportsResponseStreaming: true, 
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(request, response) {
  // Configuração CORS
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
    const { prompt, schema, isLongOutput, taskType } = body || {};

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 1. POOL DE CHAVES ---
    const keyPools = {
        commentary: [], dictionary: [], devotional: [], ebd: [], metadata: [], general: []
    };

    // Coleta chaves do ENV
    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.trim().length > 20) {
            const key = val.trim();
            if (i >= 1 && i <= 5) keyPools.commentary.push(key);
            else if (i >= 6 && i <= 8) keyPools.dictionary.push(key);
            else if (i === 9) keyPools.devotional.push(key);
            else if (i >= 10 && i <= 14) keyPools.ebd.push(key);
            else if (i === 15) keyPools.metadata.push(key);
            else keyPools.general.push(key); 
        }
    }

    if (process.env.API_KEY) keyPools.general.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) keyPools.general.push(process.env.Biblia_ADMA_API);

    // Seleção Inteligente de Pool
    let targetPool = [];
    switch (taskType) {
        case 'commentary': targetPool = keyPools.commentary; break;
        case 'dictionary': targetPool = keyPools.dictionary; break;
        case 'devotional': targetPool = keyPools.devotional; break;
        case 'ebd': targetPool = keyPools.ebd; break;
        case 'metadata': targetPool = keyPools.metadata; break;
        default: targetPool = keyPools.general; break;
    }

    // Fallbacks
    if (targetPool.length === 0) targetPool = keyPools.general;
    if (targetPool.length === 0) targetPool = Object.values(keyPools).flat();
    
    // Remove duplicatas e embaralha
    targetPool = [...new Set(targetPool)].sort(() => 0.5 - Math.random());

    if (targetPool.length === 0) {
         return response.status(500).json({ error: 'CONFIG ERROR: Nenhuma chave de API disponível.' });
    }

    // --- 2. ESTRATÉGIA DE MODELOS ---
    // 2.5 Flash: Melhor qualidade (Principal)
    // 1.5 Flash: Maior estabilidade e velocidade (Backup Imediato)
    const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];

    // --- 3. EXECUÇÃO ---
    // Reduzimos tentativas para 3 para evitar Timeout da Vercel (10s limit no plano Hobby)
    const MAX_ATTEMPTS = 3; 
    let lastError = null;

    // --- MODO STREAMING (EBD, Comentário) ---
    if (isLongOutput && !schema) {
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const apiKey = targetPool[i % targetPool.length];
            const modelId = MODELS[i % MODELS.length];

            try {
                const ai = new GoogleGenAI({ apiKey });
                const streamResult = await ai.models.generateContentStream({
                    model: modelId,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: {
                        temperature: 0.7,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                    }
                });

                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Transfer-Encoding', 'chunked');

                for await (const chunk of streamResult) {
                    const txt = chunk.text; 
                    if (txt) response.write(txt);
                }
                
                response.end();
                return; // Sucesso

            } catch (err) {
                console.warn(`Stream Error [${i}] (${modelId}):`, err.message);
                lastError = err;
                if (response.headersSent) { response.end(); return; }
                // Delay pequeno apenas para não bater taxa instantânea
                if (i < MAX_ATTEMPTS - 1) await delay(500);
            }
        }
        return response.status(503).json({ error: `Falha na IA após ${MAX_ATTEMPTS} tentativas. Último erro: ${lastError?.message}` });
    }

    // --- MODO PADRÃO (JSON, Chat) ---
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const apiKey = targetPool[i % targetPool.length];
        const modelId = MODELS[i % MODELS.length];

        try {
            const ai = new GoogleGenAI({ apiKey });
            const config = { temperature: 0.6 };
            
            if (schema) {
                config.responseMimeType = "application/json";
                config.responseSchema = schema;
            }

            const result = await ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: config
            });

            // Sucesso
            return response.status(200).json({ text: result.text });

        } catch (err) {
            console.warn(`Standard Error [${i}] (${modelId}):`, err.message);
            lastError = err;
            if (i < MAX_ATTEMPTS - 1) await delay(500);
        }
    }

    return response.status(503).json({ error: `Serviço indisponível. Detalhe: ${lastError?.message || 'Timeout'}` });

  } catch (error) {
    return response.status(500).json({ error: `Erro Interno: ${error.message}` });
  }
}

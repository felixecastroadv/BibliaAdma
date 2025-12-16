
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, 
  supportsResponseStreaming: true, 
};

// Função de espera para não bombardear a API
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(request, response) {
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
    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }
    const { prompt, schema, isLongOutput, taskType } = body || {};

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 1. COLETA E CATEGORIZAÇÃO DE CHAVES ---
    const keyPools = {
        commentary: [], // 1-5
        dictionary: [], // 6-8
        devotional: [], // 9
        ebd: [],        // 10-14
        metadata: [],   // 15
        general: []     // 16-17 + Extras
    };

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

    // Remove duplicatas
    Object.keys(keyPools).forEach(k => { keyPools[k] = [...new Set(keyPools[k])]; });

    // Seleção de Pool
    let targetPool = [];
    switch (taskType) {
        case 'commentary': targetPool = keyPools.commentary; break;
        case 'dictionary': targetPool = keyPools.dictionary; break;
        case 'devotional': targetPool = keyPools.devotional; break;
        case 'ebd': targetPool = keyPools.ebd; break;
        case 'metadata': targetPool = keyPools.metadata; break;
        default: targetPool = keyPools.general; break;
    }

    // Fallback de pool se vazio
    if (targetPool.length === 0) targetPool = keyPools.general;
    // Fallback Supremo: Pega TUDO o que tiver
    if (targetPool.length === 0) targetPool = Object.values(keyPools).flat();

    if (targetPool.length === 0) {
         return response.status(500).json({ error: 'SERVER CONFIG ERROR: Nenhuma chave de API válida encontrada.' });
    }

    // Embaralha chaves
    const shuffledKeys = targetPool.sort(() => 0.5 - Math.random());

    // --- ESTRATÉGIA DE MODELOS (CAMADAS DE DEFESA) ---
    // 1. Principal: 2.5 Flash (Melhor Raciocínio)
    // 2. Backup 1: 2.0 Flash Exp (Muitas vezes livre quando o 2.5 cai)
    // 3. Backup 2: 1.5 Flash (O "Tanque de Guerra" - muito estável)
    const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash"];

    // --- 3. EXECUÇÃO DA IA (FORÇA BRUTA INTELIGENTE) ---
    
    // MODO STREAMING (Textos Longos: EBD, Comentário)
    if (isLongOutput && !schema) {
        let lastError = null;
        // Tenta MUITAS vezes (até 12 tentativas distribuídas entre chaves e modelos)
        const maxAttempts = Math.min(shuffledKeys.length * 2, 12); 

        for (let i = 0; i < maxAttempts; i++) {
            // Rotaciona chaves e modelos
            const apiKey = shuffledKeys[i % shuffledKeys.length];
            const modelId = MODELS[i % MODELS.length]; 

            try {
                const ai = new GoogleGenAI({ apiKey });
                const aiConfig = {
                    temperature: 0.7, 
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 8192,
                };

                const result = await ai.models.generateContentStream({
                    model: modelId,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: aiConfig
                });

                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Transfer-Encoding', 'chunked');

                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        response.write(chunkText);
                    }
                }
                
                response.end();
                return; // Sucesso Absoluto

            } catch (streamError) {
                console.warn(`Stream Fail [Attempt ${i+1}/${maxAttempts}] (${modelId}):`, streamError.message.substring(0, 50));
                lastError = streamError;
                
                if (response.headersSent) { response.end(); return; }
                
                // Backoff progressivo (1s, 2s, 3s...)
                await delay(1000 + (i * 500));
            }
        }
        
        const msg = lastError?.message || 'Erro desconhecido';
        return response.status(503).json({ error: `Sistema sobrecarregado após várias tentativas. Tente novamente em 1 minuto. (${msg})` });
    }

    // MODO PADRÃO (JSON/Curto: Dicionário, Devocional, Chat)
    let successResponse = null;
    let lastError = null;
    const shortAttempts = Math.min(shuffledKeys.length * 2, 12); // Também aumentei aqui

    for (let i = 0; i < shortAttempts; i++) {
        const apiKey = shuffledKeys[i % shuffledKeys.length];
        const modelId = MODELS[i % MODELS.length];

        try {
            const ai = new GoogleGenAI({ apiKey });
            const aiConfig = {
                temperature: 0.6,
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
            console.warn(`Standard Fail [Attempt ${i+1}/${shortAttempts}] (${modelId}):`, error.message.substring(0, 50));
            await delay(800 + (i * 400));
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const msg = lastError?.message || '';
        return response.status(503).json({ error: `Instabilidade momentânea na IA. Clique em tentar novamente. (${msg})` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor ADMA.' });
  }
}

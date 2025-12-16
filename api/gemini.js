
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
    if (targetPool.length === 0) targetPool = Object.values(keyPools).flat();

    if (targetPool.length === 0) {
         return response.status(500).json({ error: 'SERVER CONFIG ERROR: Nenhuma chave de API válida encontrada.' });
    }

    // Embaralha chaves
    const shuffledKeys = targetPool.sort(() => 0.5 - Math.random());

    // --- ESTRATÉGIA DE MODELOS ---
    // Se o principal falhar, tenta o experimental que costuma estar menos cheio
    const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-exp"];

    // --- 3. EXECUÇÃO DA IA (COM RETRY INTELIGENTE) ---
    
    // MODO STREAMING (Textos Longos: EBD, Comentário)
    if (isLongOutput && !schema) {
        let lastError = null;
        // Tenta até 4 chaves/modelos diferentes
        const attempts = Math.min(shuffledKeys.length, 4);

        for (let i = 0; i < attempts; i++) {
            const apiKey = shuffledKeys[i];
            // Alterna modelo baseado na tentativa (par/impar) para aumentar chance
            const modelId = MODELS[i % MODELS.length]; 

            try {
                const ai = new GoogleGenAI({ apiKey });
                const aiConfig = {
                    temperature: 0.7, // Reduzi levemente para estabilidade
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

                for await (const chunk of result) {
                    const chunkText = chunk.text;
                    if (chunkText) {
                        response.write(chunkText);
                    }
                }
                
                response.end();
                return; // Sucesso

            } catch (streamError) {
                console.error(`Stream Error (${taskType}) [Key ${i}]:`, streamError.message);
                lastError = streamError;
                
                // Se já enviou headers, não tem como recuperar
                if (response.headersSent) { response.end(); return; }
                
                // Se erro for 503 (Overloaded) ou 429 (Quota), espera um pouco antes de tentar a próxima chave
                if (streamError.message.includes('503') || streamError.message.includes('429')) {
                    await delay(1500 * (i + 1)); // Backoff: 1.5s, 3s, 4.5s...
                }
            }
        }
        
        // Se falhou todas
        const msg = lastError?.message || 'Erro desconhecido';
        return response.status(503).json({ error: `Servidores do Google sobrecarregados (503). Tente novamente em alguns segundos. Detalhe: ${msg}` });
    }

    // MODO PADRÃO (JSON/Curto: Dicionário, Devocional, Chat)
    let successResponse = null;
    let lastError = null;
    const shortAttempts = Math.min(shuffledKeys.length, 4);

    for (let i = 0; i < shortAttempts; i++) {
        const apiKey = shuffledKeys[i];
        const modelId = MODELS[i % MODELS.length];

        try {
            const ai = new GoogleGenAI({ apiKey });
            const aiConfig = {
                temperature: 0.6, // Mais conservador para JSON
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
            
            successResponse = result.text;
            break; // Sucesso

        } catch (error) {
            lastError = error;
            console.error(`Standard Error [Key ${i}]:`, error.message);
            if (error.message.includes('503') || error.message.includes('429')) {
                await delay(1000 * (i + 1));
            }
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const msg = lastError?.message || '';
        return response.status(503).json({ error: `Instabilidade na IA (Google 503). Por favor, clique em tentar novamente. (${msg})` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor ADMA.' });
  }
}

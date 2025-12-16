
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, 
  supportsResponseStreaming: true, 
};

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
    // Estratégia de Alocação (Baseada na solicitação):
    // 1-5: Comentários (Professor)
    // 6-8: Dicionário
    // 9: Devocional
    // 10-14: EBD (Panorama)
    // 15: Metadados (Epígrafes)
    // 16-17 + Named: Geral (Chat, Builder, Fallback)

    const keyPools = {
        commentary: [], // 1-5
        dictionary: [], // 6-8
        devotional: [], // 9
        ebd: [],        // 10-14
        metadata: [],   // 15
        general: []     // 16-17 + Extras
    };

    // Processa chaves numeradas (1 a 50)
    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        
        if (val && val.trim().length > 20) {
            const key = val.trim();
            
            // Distribuição Lógica
            if (i >= 1 && i <= 5) keyPools.commentary.push(key);
            else if (i >= 6 && i <= 8) keyPools.dictionary.push(key);
            else if (i === 9) keyPools.devotional.push(key);
            else if (i >= 10 && i <= 14) keyPools.ebd.push(key);
            else if (i === 15) keyPools.metadata.push(key);
            else if (i >= 16 && i <= 17) keyPools.general.push(key);
            // Chaves extras (18-50) vão para o pool geral como reforço
            else keyPools.general.push(key); 
        }
    }

    // Adiciona chaves nomeadas ao pool Geral
    if (process.env.API_KEY) keyPools.general.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) keyPools.general.push(process.env.Biblia_ADMA_API);

    // Remove duplicatas dentro de cada pool (sanidade)
    Object.keys(keyPools).forEach(k => {
        keyPools[k] = [...new Set(keyPools[k])];
    });

    // --- 2. SELEÇÃO DO POOL ---
    let targetPool = [];
    
    // Define qual pool usar baseado no taskType enviado pelo frontend
    switch (taskType) {
        case 'commentary': targetPool = keyPools.commentary; break;
        case 'dictionary': targetPool = keyPools.dictionary; break;
        case 'devotional': targetPool = keyPools.devotional; break;
        case 'ebd': targetPool = keyPools.ebd; break;
        case 'metadata': targetPool = keyPools.metadata; break;
        default: targetPool = keyPools.general; break;
    }

    // FALLBACK INTELIGENTE:
    // Se o pool específico estiver vazio (ex: usuário não configurou a chave 9),
    // usa o pool 'general' para não quebrar o app.
    if (targetPool.length === 0) {
        console.warn(`Pool '${taskType}' vazio. Usando General.`);
        targetPool = keyPools.general;
    }
    
    // Se ainda assim estiver vazio, tenta pegar QUALQUER chave disponível no sistema
    if (targetPool.length === 0) {
        const all = Object.values(keyPools).flat();
        targetPool = all;
    }

    if (targetPool.length === 0) {
         return response.status(500).json({ error: 'SERVER CONFIG ERROR: Nenhuma chave de API válida encontrada.' });
    }

    // Embaralha as chaves do pool selecionado
    const shuffledKeys = targetPool.sort(() => 0.5 - Math.random());

    // --- 3. EXECUÇÃO DA IA (COM RETRY) ---
    // Streaming (EBD) ou Standard
    if (isLongOutput && !schema) {
        // MODO STREAMING (EBD)
        let lastError = null;
        // Tenta até 3 chaves do pool selecionado
        const keysToTry = shuffledKeys.slice(0, 3);

        for (const apiKey of keysToTry) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                const modelId = "gemini-2.5-flash"; 

                const aiConfig = {
                    temperature: 0.8,
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

                // Correct iteration for @google/genai stream
                for await (const chunk of result) {
                    const chunkText = chunk.text;
                    if (chunkText) {
                        response.write(chunkText);
                    }
                }
                
                response.end();
                return; 

            } catch (streamError) {
                console.error(`Stream Error (${taskType}):`, streamError.message);
                lastError = streamError;
                if (response.headersSent) { response.end(); return; }
                await new Promise(r => setTimeout(r, 1000)); 
            }
        }
        
        const msg = lastError?.message || 'Erro desconhecido';
        if (msg.includes('429')) return response.status(429).json({ error: 'Cotas excedidas para esta funcionalidade. Tente mais tarde.' });
        return response.status(500).json({ error: `Falha na geração: ${msg}` });
    }

    // MODO PADRÃO (JSON/Short Text)
    let successResponse = null;
    let lastError = null;
    const shortKeysToTry = shuffledKeys.slice(0, 3);

    for (const apiKey of shortKeysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const modelId = "gemini-2.5-flash"; 
            
            const aiConfig = {
                temperature: 0.7,
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
            
            // Correct usage for @google/genai standard response
            successResponse = result.text;
            break; 

        } catch (error) {
            lastError = error;
            if (error.message.includes('429')) await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const msg = lastError?.message || '';
        if (msg.includes('429')) {
             return response.status(429).json({ error: 'Muitas requisições nesta funcionalidade. Tente novamente em 1 minuto.' });
        }
        return response.status(500).json({ error: `Erro na geração: ${msg}` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico.' });
  }
}

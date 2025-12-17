import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, // Aumentado para tolerância (embora Hobby limite a 10s, Pro vai até 300s)
};

export default async function handler(request, response) {
  // Configuração de CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- 1. COLETA MASSIVA DE CHAVES (POOL) ---
    const allKeys = [];

    if (process.env.API_KEY) allKeys.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API);

    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.length > 10) {
            allKeys.push(val);
        }
    }

    const validKeys = [...new Set(allKeys)].filter(k => k && !k.startsWith('vck_'));

    if (validKeys.length === 0) {
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada.' 
         });
    }

    // --- 2. PREPARAÇÃO DO BODY ---
    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return response.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { prompt, schema } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 3. LOOP DE ROTAÇÃO DE CHAVES (STRICT GEMINI 2.5) ---
    // Embaralha as chaves para balanceamento de carga
    const shuffledKeys = validKeys.sort(() => 0.5 - Math.random());
    
    let lastError = null;
    let successResponse = null;
    
    // Tenta no máximo 10 chaves diferentes para não estourar o tempo da função serverless
    const maxAttempts = Math.min(10, shuffledKeys.length); 
    const keysToTry = shuffledKeys.slice(0, maxAttempts);

    for (const apiKey of keysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const aiConfig = {
                temperature: 0.5, // Equilíbrio para EBD
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8192, // Permite respostas longas para EBD
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
            };

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            // FORÇA O USO DO GEMINI 2.5 FLASH (Não faz downgrade)
            const aiResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) {
                throw new Error("Resposta vazia da IA (Retry)");
            }

            successResponse = aiResponse.text;
            break; // SUCESSO! Sai do loop.

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            
            // Se for erro de COTA (429) ou SERVIDOR (503), continua para a próxima chave.
            // Se for erro de BAD REQUEST (400), provavelmente é o prompt/schema, então para.
            if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
                return response.status(400).json({ error: `Erro no formato da requisição: ${msg}` });
            }

            // Pequeno delay (Cool Down) antes de tentar a próxima chave para evitar banimento de IP
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        // Se todas as tentativas falharam
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        console.error("Todas as chaves falharam. Último erro:", errorMsg);
        
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'ALTA DEMANDA: O sistema está sobrecarregado no momento. Aguarde 1 minuto e tente novamente.' 
            });
        }
        
        return response.status(500).json({ error: `Falha na geração: ${errorMsg}` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor.' });
  }
}
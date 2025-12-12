import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, // Aumenta tempo limite para permitir múltiplas tentativas
};

export default async function handler(request, response) {
  // CORS Configuration
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
    // --- 1. COLETA DE TODAS AS CHAVES ---
    const envKeys = [
        { name: 'API_KEY', val: process.env.API_KEY },
        { name: 'Biblia_ADMA_API', val: process.env.Biblia_ADMA_API },
        { name: 'API_KEY_2', val: process.env.API_KEY_2 },
        { name: 'API_KEY_3', val: process.env.API_KEY_3 },
        { name: 'API_KEY_4', val: process.env.API_KEY_4 },
        { name: 'API_KEY_5', val: process.env.API_KEY_5 },
        { name: 'API_KEY_6', val: process.env.API_KEY_6 },
        { name: 'API_KEY_7', val: process.env.API_KEY_7 },
        { name: 'API_KEY_8', val: process.env.API_KEY_8 },
        { name: 'API_KEY_9', val: process.env.API_KEY_9 },
        { name: 'API_KEY_10', val: process.env.API_KEY_10 }
    ];

    const validKeys = envKeys.filter(k => k.val && k.val.length > 20);

    if (validKeys.length === 0) {
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada na Vercel.' 
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

    // --- 3. LOOP DE ROTAÇÃO DE CHAVES (FAILOVER) ---
    // Embaralha as chaves para distribuir a carga
    const shuffledKeys = validKeys.map(k => k.val).sort(() => 0.5 - Math.random());
    
    let lastError = null;
    let successResponse = null;

    console.log(`🔄 [Gemini Router] Iniciando tentativa com ${shuffledKeys.length} chaves.`);

    for (const apiKey of shuffledKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            const modelId = "gemini-2.5-flash"; 

            const aiConfig = {
                temperature: 0.9, 
                topP: 0.95,
                topK: 40,
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

            // Tenta gerar com a chave atual
            const aiResponse = await ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) {
                throw new Error(aiResponse.candidates?.[0]?.finishReason || "EMPTY_RESPONSE");
            }

            // SUCESSO!
            successResponse = aiResponse.text;
            break; // Sai do loop

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            
            // Verifica se é erro de Cota (429) ou Serviço Indisponível (503)
            const isQuotaError = msg.includes('429') || msg.includes('Quota') || msg.includes('Too Many Requests');
            const isServerError = msg.includes('503') || msg.includes('500') || msg.includes('Overloaded');

            if (isQuotaError || isServerError) {
                console.warn(`⚠️ Chave falhou (${isQuotaError ? 'Cota' : 'Server'}). Tentando próxima...`);
                continue; // Tenta a próxima
            } else {
                console.error(`❌ Erro fatal na chave: ${msg}`);
                break; // Se for erro de prompt ou formato, não adianta trocar a chave
            }
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        console.error("❌ TODAS AS CHAVES FALHARAM.");
        const errorMsg = lastError?.message || 'Erro desconhecido em todas as chaves.';
        
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ error: 'QUOTA_EXCEEDED: Todas as chaves atingiram o limite.' });
        }
        
        return response.status(500).json({ error: errorMsg });
    }

  } catch (error) {
    console.error("Gemini Critical Error:", error);
    return response.status(500).json({ error: 'Erro crítico no servidor.' });
  }
}
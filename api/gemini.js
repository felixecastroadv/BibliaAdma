import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 300, // 5 minutos (Máximo para Hobby/Pro em Serverless)
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
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada (API_KEY_1...50).' 
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

    // --- 3. LOOP DE ROTAÇÃO DE CHAVES (FAILOVER INTELIGENTE) ---
    const shuffledKeys = validKeys.sort(() => 0.5 - Math.random());
    
    let lastError = null;
    let successResponse = null;
    let attempts = 0;

    // Define os modelos para tentar (Prioridade: 2.5 Flash -> Fallback: 1.5 Flash)
    // 1.5 Flash tem cotas separadas e é muito estável para textos longos
    const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash"];

    outerLoop:
    for (const apiKey of shuffledKeys) {
        attempts++;
        
        // Tenta cada modelo disponível para a chave atual
        for (const modelId of modelsToTry) {
            try {
                const ai = new GoogleGenAI({ apiKey });
                
                const aiConfig = {
                    temperature: 0.5, // Equilíbrio para EBD
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

                // console.log(`Tentando chave ${attempts} com modelo ${modelId}...`);

                const aiResponse = await ai.models.generateContent({
                    model: modelId,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: aiConfig
                });

                if (!aiResponse.text) {
                    throw new Error(aiResponse.candidates?.[0]?.finishReason || "EMPTY_RESPONSE_RETRY");
                }

                successResponse = aiResponse.text;
                break outerLoop; // Sucesso total, sai de todos os loops

            } catch (error) {
                lastError = error;
                const msg = error.message || '';
                
                const isQuotaError = msg.includes('429') || msg.includes('Quota') || msg.includes('Too Many Requests') || msg.includes('Exhausted');
                const isServerError = msg.includes('503') || msg.includes('500') || msg.includes('Overloaded');

                if (isQuotaError || isServerError) {
                    // Se falhou por cota, não adianta tentar outro modelo na MESMA chave.
                    // Sai do loop de modelos e vai para a próxima chave.
                    break; 
                } 
                // Se for outro erro (ex: Invalid Argument), pode tentar o modelo fallback na mesma chave
            }
        }

        // --- COOL DOWN ---
        // Se a chave falhou (cota), espera um pouco antes de tentar a próxima.
        // Isso evita que o Google bloqueie o IP do servidor por "ataque" de requisições.
        if (!successResponse) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'ALTA DEMANDA: Todas as chaves do sistema estão ocupadas neste exato momento. Aguarde 30 segundos e tente novamente.' 
            });
        }
        
        return response.status(500).json({ error: `Erro na IA: ${errorMsg}` });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor.' });
  }
}
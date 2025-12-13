import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 60, // Tempo máximo de execução (segundos)
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

    // Adiciona chaves nomeadas específicas que você já usa
    if (process.env.API_KEY) allKeys.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API);

    // Adiciona chaves numeradas automaticamente de 1 até 50
    // Isso permite que você adicione API_KEY_15, API_KEY_20 na Vercel sem mexer no código
    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.length > 10) {
            allKeys.push(val);
        }
    }

    // Remove duplicatas e chaves inválidas
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
    // Embaralha as chaves para distribuir a carga (Load Balancing)
    const shuffledKeys = validKeys.sort(() => 0.5 - Math.random());
    
    let lastError = null;
    let successResponse = null;
    let attempts = 0;

    console.log(`🔄 [Gemini Pool] Iniciando com ${validKeys.length} chaves disponíveis.`);

    for (const apiKey of shuffledKeys) {
        attempts++;
        try {
            // Configura o cliente com a chave atual do loop
            const ai = new GoogleGenAI({ apiKey });
            
            // Modelo Flash é mais rápido e econômico
            const modelId = "gemini-2.5-flash"; 

            const aiConfig = {
                temperature: 0.7, // Levemente criativo, mas focado
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

            // Tenta gerar
            const aiResponse = await ai.models.generateContent({
                model: modelId,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) {
                // Se a resposta for vazia mas sem erro explícito, forçamos um erro para trocar a chave
                throw new Error(aiResponse.candidates?.[0]?.finishReason || "EMPTY_RESPONSE_RETRY");
            }

            // SUCESSO!
            successResponse = aiResponse.text;
            // console.log(`✅ Sucesso na tentativa ${attempts}`);
            break; // Sai do loop imediatamente

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            
            // Lista de erros que indicam que devemos tentar a PRÓXIMA chave
            const isQuotaError = msg.includes('429') || msg.includes('Quota') || msg.includes('Too Many Requests') || msg.includes('Exhausted');
            const isServerError = msg.includes('503') || msg.includes('500') || msg.includes('Overloaded') || msg.includes('EMPTY_RESPONSE');

            if (isQuotaError || isServerError) {
                console.warn(`⚠️ Chave ${attempts} falhou (${isQuotaError ? 'Cota' : 'Erro'}). Trocando para próxima...`);
                continue; // Pula para a próxima iteração do loop (próxima chave)
            } else {
                // Se for um erro do usuário (ex: Prompt inválido), paramos para não gastar todas as chaves à toa
                console.error(`❌ Erro fatal (não é cota): ${msg}`);
                break; 
            }
        }
    }

    // --- 4. RESPOSTA FINAL ---
    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        // Se chegou aqui, TODAS as chaves do array falharam
        console.error("❌ FALHA TOTAL: Todas as chaves do pool foram testadas e falharam.");
        
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'SISTEMA SOBRECARREGADO: Todas as chaves de API atingiram o limite simultaneamente. Tente novamente em 2 minutos.' 
            });
        }
        
        return response.status(500).json({ error: `Erro na geração: ${errorMsg}` });
    }

  } catch (error) {
    console.error("Gemini Critical Server Error:", error);
    return response.status(500).json({ error: 'Erro interno crítico no servidor.' });
  }
}
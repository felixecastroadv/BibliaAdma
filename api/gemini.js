import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, 
};

export default async function handler(request, response) {
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
    // Lista sequencial absoluta (Ordem solicitada)
    const keysPool = [
      process.env.API_KEY,
      process.env.Biblia_ADMA_API,
      process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3,
      process.env.API_KEY_4, process.env.API_KEY_5, process.env.API_KEY_6,
      process.env.API_KEY_7, process.env.API_KEY_8, process.env.API_KEY_9,
      process.env.API_KEY_10, process.env.API_KEY_11, process.env.API_KEY_12,
      process.env.API_KEY_13, process.env.API_KEY_14, process.env.API_KEY_15,
      process.env.API_KEY_16, process.env.API_KEY_17, process.env.API_KEY_18,
      process.env.API_KEY_19, process.env.API_KEY_20, process.env.API_KEY_21
    ].filter(k => k && k.trim().length > 10);

    if (keysPool.length === 0) {
      return response.status(500).json({ error: 'Nenhuma chave API configurada no Vercel.' });
    }

    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { return response.status(400).json({ error: 'Invalid JSON body' }); }
    }
    
    const { prompt, schema, systemInstruction } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let lastError = null;
    let successResponse = null;
    let attemptCount = 0;

    // REVEZAMENTO SEQUENCIAL (RELAY)
    for (const currentKey of keysPool) {
      attemptCount++;
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const genConfig = {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        };

        if (schema) {
          genConfig.responseMimeType = "application/json";
          genConfig.responseSchema = schema;
        }

        const res = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            ...genConfig,
            systemInstruction: systemInstruction || "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e erudito.",
          }
        });
        
        if (res.text) {
          successResponse = res.text;
          break; // SUCESSO: Interrompe o loop
        } else {
          throw new Error("API retornou texto vazio.");
        }
      } catch (error) {
        lastError = error;
        const msg = error.message || "";
        console.error(`Tentativa ${attemptCount}/${keysPool.length} falhou: ${msg}`);
        
        // Se for erro de rede, espera 200ms antes de tentar a próxima para não "atropelar"
        if (msg.includes('fetch') || msg.includes('network')) {
            await new Promise(r => setTimeout(r, 200));
        }
        // Continua para a próxima chave do pool
      }
    }

    if (successResponse) {
      return response.status(200).json({ text: successResponse });
    } else {
      // Retorna erro detalhado da última chave para debug
      return response.status(500).json({ 
        error: `Falha total: Todas as ${keysPool.length} chaves foram tentadas sequencialmente, mas nenhuma obteve sucesso.`,
        detail: lastError?.message || "Erro desconhecido nas APIs."
      });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro crítico no orquestrador de chaves.' });
  }
}
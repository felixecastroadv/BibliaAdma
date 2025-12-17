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
    // Lista sequencial rigorosa
    const rawKeys = [
      process.env.API_KEY,
      process.env.Biblia_ADMA_API,
      process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3,
      process.env.API_KEY_4, process.env.API_KEY_5, process.env.API_KEY_6,
      process.env.API_KEY_7, process.env.API_KEY_8, process.env.API_KEY_9,
      process.env.API_KEY_10, process.env.API_KEY_11, process.env.API_KEY_12,
      process.env.API_KEY_13, process.env.API_KEY_14, process.env.API_KEY_15,
      process.env.API_KEY_16, process.env.API_KEY_17, process.env.API_KEY_18,
      process.env.API_KEY_19, process.env.API_KEY_20, process.env.API_KEY_21
    ];

    const apiKeys = rawKeys.filter(k => k && k.trim().length > 20);

    if (apiKeys.length === 0) {
      return response.status(500).json({ error: 'Nenhuma chave API configurada no ambiente.' });
    }

    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { return response.status(400).json({ error: 'Invalid JSON' }); }
    }
    
    const { prompt, schema, systemInstruction } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let lastError = null;
    let successResponse = null;

    // REVEZAMENTO SEQUENCIAL (RELAY)
    for (let i = 0; i < apiKeys.length; i++) {
      const currentKey = apiKeys[i];
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const generationConfig = {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        };

        if (schema) {
          generationConfig.responseMimeType = "application/json";
          generationConfig.responseSchema = schema;
        }

        const res = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            ...generationConfig,
            systemInstruction: systemInstruction || "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e erudito.",
          }
        });
        
        if (res.text) {
          successResponse = res.text;
          break; // SUCESSO: Para o loop e retorna
        } else {
          throw new Error("Resposta vazia da API.");
        }
      } catch (error) {
        const errorMsg = error.message || "";
        console.error(`Chave index ${i} falhou: ${errorMsg}`);
        lastError = error;

        // Se for erro de cota ou limite, passa para a próxima sem hesitar
        if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('limit')) {
            continue; 
        }
        
        // Se for erro de chave inválida, também pula
        if (errorMsg.includes('API key not valid')) {
            continue;
        }

        // Para outros erros (como erro de rede ou prompt bloqueado), tentamos mais uma vez ou passamos
        continue;
      }
    }

    if (successResponse) {
      return response.status(200).json({ text: successResponse });
    } else {
      return response.status(500).json({ 
        error: `Todas as ${apiKeys.length} chaves falharam sequencialmente.`,
        detail: lastError?.message 
      });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro crítico no processador de revezamento.' });
  }
}
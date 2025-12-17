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
    // Pool expandido para garantir que novas chaves (até 30) sejam capturadas
    const rawPool = [
      process.env.API_KEY,
      process.env.Biblia_ADMA_API,
      process.env.API_KEY_1, process.env.API_KEY_2, process.env.API_KEY_3,
      process.env.API_KEY_4, process.env.API_KEY_5, process.env.API_KEY_6,
      process.env.API_KEY_7, process.env.API_KEY_8, process.env.API_KEY_9,
      process.env.API_KEY_10, process.env.API_KEY_11, process.env.API_KEY_12,
      process.env.API_KEY_13, process.env.API_KEY_14, process.env.API_KEY_15,
      process.env.API_KEY_16, process.env.API_KEY_17, process.env.API_KEY_18,
      process.env.API_KEY_19, process.env.API_KEY_20, process.env.API_KEY_21,
      process.env.API_KEY_22, process.env.API_KEY_23, process.env.API_KEY_24,
      process.env.API_KEY_25, process.env.API_KEY_26, process.env.API_KEY_27,
      process.env.API_KEY_28, process.env.API_KEY_29, process.env.API_KEY_30
    ];

    const apiKeys = rawPool.filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) {
      return response.status(500).json({ error: 'Nenhuma chave API encontrada nas variáveis de ambiente da Vercel.' });
    }

    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { return response.status(400).json({ error: 'Invalid JSON body' }); }
    }
    
    const { prompt, schema, systemInstruction } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let lastError = null;
    let successResponse = null;
    let attempt = 0;

    // REVEZAMENTO SEQUENCIAL RIGOROSO (Inicia do 0 até o fim)
    for (const currentKey of apiKeys) {
      attempt++;
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
          break; // Sucesso absoluto, retorna para o app
        }
      } catch (error) {
        lastError = error;
        const msg = error.message || "";
        console.error(`Chave ${attempt}/${apiKeys.length} falhou: ${msg}`);

        // Se o erro for de segurança do prompt (HATE, HARASSMENT), não adianta trocar de chave.
        if (msg.includes('SAFETY') || msg.includes('blocked')) {
            return response.status(400).json({ 
                error: "O conteúdo solicitado foi bloqueado pelos filtros de segurança da IA. Tente reformular o pedido.",
                detail: msg
            });
        }

        // Se for erro de rede/conexão, espera 100ms para a próxima tentativa não ser ignorada pelo servidor
        if (msg.includes('fetch') || msg.includes('network')) {
            await new Promise(r => setTimeout(r, 100));
        }
        
        // Continua para a próxima chave (429, 500, 503, etc)
      }
    }

    if (successResponse) {
      return response.status(200).json({ text: successResponse });
    } else {
      return response.status(500).json({ 
        error: `Falha total: Todas as ${apiKeys.length} chaves falharam.`,
        detail: lastError?.message || "Serviço temporariamente indisponível."
      });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro crítico no processador de revezamento.' });
  }
}
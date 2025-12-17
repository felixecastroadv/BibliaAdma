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
    // Coleta exaustiva baseada nos nomes vistos nos seus prints da Vercel
    const keysNames = [
      'API_KEY',
      'Biblia_ADMA',
      'BIBLIA_ADMA',
      'Biblia_ADMA_API',
      'API_Biblia_ADMA'
    ];
    
    // Adiciona as numeradas de 1 a 30
    for(let i=1; i<=30; i++) keysNames.push(`API_KEY_${i}`);

    const apiKeys = keysNames
      .map(name => process.env[name])
      .filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) {
      return response.status(500).json({ error: 'O sistema não conseguiu ler nenhuma chave das variáveis de ambiente. Verifique se os nomes na Vercel coincidem (Ex: API_KEY_1).' });
    }

    let body = request.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { return response.status(400).json({ error: 'Invalid JSON body' }); }
    }
    
    const { prompt, schema, systemInstruction } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let lastError = null;
    let successResponse = null;
    let keysTried = 0;

    // REVEZAMENTO SEQUENCIAL
    for (const currentKey of apiKeys) {
      keysTried++;
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const config = {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 8192,
        };

        if (schema) {
          config.responseMimeType = "application/json";
          config.responseSchema = schema;
        }

        const res = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            ...config,
            systemInstruction: systemInstruction || "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e erudito.",
          }
        });
        
        if (res.text) {
          successResponse = res.text;
          break; 
        }
      } catch (error) {
        lastError = error;
        const msg = error.message || "";
        
        // Se o erro for de segurança, para tudo (não é culpa da chave)
        if (msg.includes('SAFETY') || msg.includes('blocked')) {
            return response.status(400).json({ error: "Conteúdo bloqueado pelos filtros de segurança.", detail: msg });
        }
        
        // Em caso de outros erros, continua para a próxima chave
        continue;
      }
    }

    if (successResponse) {
      return response.status(200).json({ text: successResponse });
    } else {
      return response.status(500).json({ 
        error: `Falha total: Todas as ${apiKeys.length} chaves detectadas falharam.`,
        detail: lastError?.message || "Verifique se as chaves no Google AI Studio estão ativas e se o modelo 'gemini-3-pro-preview' está disponível nelas."
      });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro crítico no processador de revezamento.' });
  }
}
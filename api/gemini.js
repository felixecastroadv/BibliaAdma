import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, 
};

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    // Lista exaustiva de possíveis nomes na Vercel
    const keysNames = [
      'API_KEY',
      'Biblia_ADMA_API',
      'Biblia_ADMA',
      'API_Biblia_ADMA',
      'BIBLIA_ADMA',
      'API Biblia_ADMA' // Nome exato visto no print da lista da Vercel
    ];
    
    for(let i=1; i<=40; i++) keysNames.push(`API_KEY_${i}`);

    // Filtra e limpa chaves
    let apiKeys = keysNames
      .map(name => process.env[name])
      .filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) {
      return response.status(500).json({ error: 'Nenhuma chave API detectada nas variáveis de ambiente da Vercel.' });
    }

    // EMBARALHAMENTO (Shuffle) para distribuir o uso entre as 26+ chaves
    apiKeys = apiKeys.sort(() => Math.random() - 0.5);

    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
    }
    const { prompt, schema, systemInstruction } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let lastError = null;
    let successResponse = null;

    // Tenta cada chave sequencialmente (agora em ordem aleatória)
    for (const currentKey of apiKeys) {
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const config = {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 8192,
        };

        if (schema) {
          config.responseMimeType = "application/json";
          config.responseSchema = schema;
        }

        // ALTERADO PARA FLASH: Mais estável e maior cota para chaves free
        const res = await ai.models.generateContent({
          model: "gemini-3-flash-preview", 
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            ...config,
            systemInstruction: systemInstruction || "Você é o Professor Michel Felix, teólogo Pentecostal.",
          }
        });
        
        if (res.text) {
          successResponse = res.text;
          break; 
        }
      } catch (error) {
        lastError = error;
        const msg = error.message || "";
        if (msg.includes('SAFETY') || msg.includes('blocked')) {
            return response.status(400).json({ error: "Conteúdo bloqueado pelos filtros de segurança.", detail: msg });
        }
        // Se for erro de autenticação ou cota, continua para a próxima chave
        continue;
      }
    }

    if (successResponse) {
      return response.status(200).json({ text: successResponse });
    } else {
      // Retorna o erro detalhado da última tentativa para diagnóstico
      const errorDetail = lastError?.message || "Erro desconhecido.";
      return response.status(500).json({ 
        error: `Falha total: Todas as ${apiKeys.length} chaves falharam.`,
        detail: `Motivo da última falha: ${errorDetail}`
      });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno no processador de IA.' });
  }
}
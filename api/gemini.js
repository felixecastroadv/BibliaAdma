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
    // Lista exaustiva baseada nos seus prints da Vercel
    const keysNames = [
      'API_KEY',
      'Biblia_ADMA_API',
      'Biblia_ADMA',
      'API_Biblia_ADMA',
      'BIBLIA_ADMA'
    ];
    
    // Suporte expandido para até 40 chaves numeradas
    for(let i=1; i<=40; i++) keysNames.push(`API_KEY_${i}`);

    // Filtra apenas as que possuem valor preenchido na Vercel
    const apiKeys = keysNames
      .map(name => process.env[name])
      .filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) {
      return response.status(500).json({ error: 'Nenhuma chave API detectada. Verifique as variáveis de ambiente na Vercel.' });
    }

    const { prompt, schema, systemInstruction } = request.body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let lastError = null;
    let successResponse = null;

    // Tenta cada chave sequencialmente
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

        const res = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            ...config,
            systemInstruction: systemInstruction || "Você é o Professor Michel Felix.",
          }
        });
        
        if (res.text) {
          successResponse = res.text;
          break; // Sucesso: sai do loop de chaves
        }
      } catch (error) {
        lastError = error;
        const msg = error.message || "";
        // Se for erro de segurança, não adianta trocar de chave
        if (msg.includes('SAFETY') || msg.includes('blocked')) {
            return response.status(400).json({ error: "Conteúdo bloqueado pelos filtros de segurança.", detail: msg });
        }
        // Caso contrário, tenta a próxima chave (429, 401, etc)
        continue;
      }
    }

    if (successResponse) {
      return response.status(200).json({ text: successResponse });
    } else {
      return response.status(500).json({ 
        error: `Falha total: Todas as ${apiKeys.length} chaves configuradas falharam.`,
        detail: lastError?.message || "Erro desconhecido."
      });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro crítico no servidor.' });
  }
}
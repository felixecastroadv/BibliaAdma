import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
// Permite execução de até 60 segundos (padrão é 10s no plano Hobby)
export const config = {
  maxDuration: 60,
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
    // ATUALIZAÇÃO: Aceita tanto API_KEY quanto o nome personalizado que você criou (Biblia_ADMA_API)
    const apiKey = process.env.API_KEY || process.env.Biblia_ADMA_API;

    if (!apiKey) {
         console.error("CRITICAL ERROR: API Key is missing in Vercel Environment Variables.");
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: A Chave de API não foi encontrada. Verifique se a variável Biblia_ADMA_API está configurada na Vercel.' 
         });
    }

    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return response.status(400).json({ error: 'Invalid JSON body' });
        }
    }

    const { prompt, schema } = body || {};

    if (!prompt) {
        return response.status(400).json({ error: 'Prompt é obrigatório' });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Using gemini-2.5-flash as requested for free tier optimization
    const modelId = "gemini-2.5-flash";

    const aiConfig = {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        // Configurações de segurança permissivas para conteúdo bíblico (guerras, sacrifícios, etc)
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

    const aiResponse = await ai.models.generateContent({
        model: modelId,
        contents: [{ parts: [{ text: prompt }] }],
        config: aiConfig
    });

    if (!aiResponse.text) {
        console.error("Gemini returned empty text. Candidates:", JSON.stringify(aiResponse.candidates));
        // Tenta extrair motivo do bloqueio se houver
        const finishReason = aiResponse.candidates?.[0]?.finishReason;
        return response.status(500).json({ error: `A IA não retornou texto. Motivo: ${finishReason || 'Desconhecido'}` });
    }

    return response.status(200).json({ text: aiResponse.text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return response.status(500).json({ error: error.message || 'Erro interno na IA.' });
  }
}
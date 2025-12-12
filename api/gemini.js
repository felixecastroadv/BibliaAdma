import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
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
    // --- SISTEMA DE ROTAÇÃO DE CHAVES (ROUND ROBIN) ---
    // Mapeia as chaves do ambiente com seus nomes para log de debug
    const envKeys = [
        { name: 'API_KEY', val: process.env.API_KEY },
        { name: 'Biblia_ADMA_API', val: process.env.Biblia_ADMA_API },
        { name: 'API_KEY_2', val: process.env.API_KEY_2 },
        { name: 'API_KEY_3', val: process.env.API_KEY_3 },
        { name: 'API_KEY_4', val: process.env.API_KEY_4 },
        { name: 'API_KEY_5', val: process.env.API_KEY_5 }
    ];

    // Filtra apenas as chaves válidas (não vazias e com tamanho mínimo)
    const validKeys = envKeys.filter(k => k.val && k.val.length > 10);

    // --- LOG DE DIAGNÓSTICO (Visível nos Logs da Vercel) ---
    // Isso ajuda você a saber se suas chaves foram carregadas corretamente
    if (validKeys.length > 0) {
        console.log(`✅ [Gemini Load Balancer] Chaves ativas: ${validKeys.map(k => `${k.name} (...${k.val.slice(-4)})`).join(', ')}`);
    } else {
        console.error("❌ [Gemini Load Balancer] Nenhuma chave encontrada!");
    }

    if (validKeys.length === 0) {
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada na Vercel. Adicione API_KEY, API_KEY_2, etc nas Variáveis de Ambiente.' 
         });
    }

    // Extrai apenas os valores das chaves para uso
    const keys = validKeys.map(k => k.val);

    // Escolhe uma chave aleatória para distribuir a carga
    const randomKey = keys[Math.floor(Math.random() * keys.length)];

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
    
    const ai = new GoogleGenAI({ apiKey: randomKey });
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

    const aiResponse = await ai.models.generateContent({
        model: modelId,
        contents: [{ parts: [{ text: prompt }] }],
        config: aiConfig
    });

    if (!aiResponse.text) {
        const finishReason = aiResponse.candidates?.[0]?.finishReason;
        let customError = `A IA não retornou texto. Motivo: ${finishReason}`;
        
        if (finishReason === 'RECITATION') {
            customError = "RECITATION_ERROR"; 
        }
        
        return response.status(500).json({ error: customError });
    }

    return response.status(200).json({ text: aiResponse.text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    
    if (error.message && (error.message.includes('429') || error.message.includes('Quota'))) {
        return response.status(429).json({ error: 'QUOTA_EXCEEDED' });
    }

    return response.status(500).json({ error: error.message || 'Erro interno na IA.' });
  }
}
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
    // Busca chaves do ambiente
    const apiKeys = [
      process.env.API_KEY,
      process.env.Biblia_ADMA_API
    ].filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) return response.status(500).json({ error: 'Chave de API não configurada.' });

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { prompt, systemInstruction, taskType } = body || {};

    const isPanorama = taskType === 'ebd' || prompt.includes("PANORÂMA") || prompt.includes("MICROSCOPIA");
    
    // MODELO PRO PARA PANORAMA (Lento e Profundo)
    // MODELO FLASH PARA O RESTO (Rápido e Simples)
    const modelName = isPanorama ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    const ai = new GoogleGenAI({ apiKey: apiKeys[0] });
    
    const config = {
      temperature: isPanorama ? 1.0 : 0.7,
      topP: 0.95,
      // Se for Panorama, ativa o Raciocínio (Thinking) para garantir profundidade
      ...(isPanorama ? { 
        thinkingConfig: { thinkingBudget: 32768 } 
      } : {})
    };

    const res = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        ...config,
        systemInstruction: systemInstruction || "Você é o Professor Michel Felix, um teólogo erudito e profundo.",
      }
    });

    if (res.text) {
      return response.status(200).json({ text: res.text });
    } else {
      throw new Error("Resposta vazia da IA.");
    }

  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: 'Erro no processamento da IA.', detail: error.message });
  }
}
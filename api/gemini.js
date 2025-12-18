
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
    const apiKeys = [
      process.env.API_KEY,
      process.env.Biblia_ADMA_API,
      process.env.BIBLIA_ADMA
    ].filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) return response.status(500).json({ error: 'Chave de API não configurada.' });

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { prompt, systemInstruction, taskType } = body || {};

    const isPanorama = taskType === 'ebd' || prompt.includes("PANORÂMA") || prompt.includes("MICROSCOPIA");
    const modelName = 'gemini-2.5-flash-preview-09-2025';

    const ai = new GoogleGenAI({ apiKey: apiKeys[0] });
    
    let finalSystemInstruction = systemInstruction || "Você é o Professor Michel Felix.";

    if (isPanorama) {
      finalSystemInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX, PH.D EM EXEGESE.
      SUA ORDEM É OBEDECER 100% AO PANORAMAVIEW:
      1. PROIBIDO RESUMIR: Explique o capítulo INTEIRO, versículo por versículo.
      2. ESTRUTURA OBRIGATÓRIA: Encerre SEMPRE com:
         ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO
         ### CURIOSIDADES GEOGRÁFICAS E ARQUEOLOGIA
      3. Use <hr class="page-break"> entre os tópicos principais.
      4. Tom Erudito e Pentecostal Clássico.`;
    }

    // CORREÇÃO CRÍTICA: maxOutputTokens deve ser a SOMA (pensamento + resposta)
    const thinkingBudget = isPanorama ? 24576 : 0;
    const responseTokens = 8192;

    const res = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: isPanorama ? 1.0 : 0.7,
        topP: 0.95,
        maxOutputTokens: thinkingBudget + responseTokens, // Garante que há espaço para o texto final
        thinkingConfig: thinkingBudget > 0 ? { thinkingBudget: thinkingBudget } : undefined,
        systemInstruction: finalSystemInstruction,
      }
    });

    if (res.text) {
      return response.status(200).json({ text: res.text });
    } else {
      throw new Error("A IA processou mas não retornou texto.");
    }

  } catch (error) {
    console.error("API Error:", error);
    // Retorna o erro detalhado para evitar o "Erro de Processamento" genérico
    return response.status(500).json({ 
      error: 'Erro na conexão com a Inteligência Bíblica.', 
      detail: error.message 
    });
  }
}

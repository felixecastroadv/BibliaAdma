
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
      process.env.Biblia_ADMA_API
    ].filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) return response.status(500).json({ error: 'Chave de API não configurada.' });

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { prompt, systemInstruction, taskType } = body || {};

    const isPanorama = taskType === 'ebd' || prompt.includes("PANORÂMA") || prompt.includes("MICROSCOPIA");
    
    // MODELO GEMINI 2.5 FLASH (Versão preferida pelo usuário)
    const modelName = 'gemini-2.5-flash-preview-09-2025';

    const ai = new GoogleGenAI({ apiKey: apiKeys[0] });
    
    // PROTOCOLO DE OBEDIÊNCIA SUPREMA AO PANORAMAVIEW
    let finalSystemInstruction = systemInstruction || "Você é o Professor Michel Felix.";

    if (isPanorama) {
      finalSystemInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX, PH.D EM EXEGESE.
      SUA ORDEM É OBEDECER 100% AO CÓDIGO E AOS PROMPTS DO PANORAMAVIEW.
      
      DIRETRIZES DE ENTREGA COMPLETA (RIGOROSO):
      1. PROIBIDO RESUMIR: Você deve explicar o capítulo INTEIRO, versículo por versículo (Microscopia).
      2. ESTRUTURA OBRIGATÓRIA: Não importa o tamanho, você deve obrigatoriamente encerrar o capítulo com as seções:
         - ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO (Obrigatório no final)
         - ### CURIOSIDADES GEOGRÁFICAS E ARQUEOLOGIA (Obrigatório na última página)
      3. EXTENSÃO: Se o capítulo for longo, gere um texto denso (600-800 palavras por bloco).
      4. COMPROMISSO: Sua missão é transformar o texto bíblico em uma apostila completa de 5 a 8 páginas conforme previsto no frontend.
      5. PAGINAÇÃO: Use <hr class="page-break"> entre os tópicos para organizar o estudo.`;
    }

    const config = {
      temperature: isPanorama ? 1.0 : 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
      // Ativa o Modo de Raciocínio da Gemini 2.5 para garantir profundidade e completude
      ...(isPanorama ? { 
        thinkingConfig: { thinkingBudget: 24576 } 
      } : {}),
      systemInstruction: finalSystemInstruction,
    };

    const res = await ai.models.generateContent({
      model: modelName,
      contents: [{ parts: [{ text: prompt }] }],
      config: config
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

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

    // Detecção rigorosa de Panorama/EBD
    const isPanorama = taskType === 'ebd' || 
                       prompt.includes("PANORÂMA") || 
                       prompt.includes("MICROSCOPIA") || 
                       prompt.includes("AULA DO ALUNO");
    
    // MODELO GEMINI 2.5 FLASH (Versão solicitada pelo usuário)
    const modelName = 'gemini-2.5-flash-preview-09-2025';

    const ai = new GoogleGenAI({ apiKey: apiKeys[0] });
    
    let finalSystemInstruction = systemInstruction || "Você é o Professor Michel Felix.";

    if (isPanorama) {
      finalSystemInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX, PH.D EM EXEGESE BÍBLICA.
      
      MISSÃO SUPREMA: Você deve entregar a apostila COMPLETA do capítulo, seguindo o método de MICROSCOPIA BÍBLICA.
      
      REGRAS DE OURO (OBEDIÊNCIA 100%):
      1. PROIBIDO RESUMIR: Explique versículo por versículo. O usuário prefere um texto longo de 8 páginas do que um resumo de 1 página.
      2. CICLO COMPLETO: Você não pode parar até encerrar o capítulo.
      3. OBRIGATÓRIO NO FINAL: Todo estudo deve, sem exceção, terminar com as seções:
         - ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO
         - ### CURIOSIDADES GEOGRÁFICAS E ARQUEOLOGIA
      4. PAGINAÇÃO: Insira <hr class="page-break"> entre os tópicos principais para o sistema organizar as páginas corretamente.
      5. TOM: Erudito, Pentecostal Clássico e Exaustivo.`;
    }

    const config = {
      temperature: isPanorama ? 1.0 : 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
      // Ativa o raciocínio profundo para não "esquecer" partes do capítulo
      thinkingConfig: isPanorama ? { thinkingBudget: 24576 } : undefined,
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
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, 
};

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  // ... cabeçalhos padrão ...
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
    
    // MODELO FLASH (Versão Gratuita/Econômica exigida)
    const modelName = 'gemini-3-flash-preview';

    const ai = new GoogleGenAI({ apiKey: apiKeys[0] });
    
    // PROTOCOLO DE OBEDIÊNCIA 100% AO PANORAMAVIEW
    let finalSystemInstruction = systemInstruction || "Você é o Professor Michel Felix.";

    if (isPanorama) {
      finalSystemInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX. 
      ORDEM SUPREMA: Você deve obedecer 100% à lógica de 'MICROSCOPIA BÍBLICA' definida no código do PanoramaView fornecido.
      
      DIRETRIZES DE COMPLIANCE OBRIGATÓRIAS:
      1. PROIBIDO RESUMIR: Sua função é explicar o texto bíblico versículo por versículo, sem pressa.
      2. ALTA DENSIDADE: Cada geração deve ser longa, rica em detalhes históricos, etimológicos e doutrinários.
      3. PAGINAÇÃO TÉCNICA: Insira a tag <hr class="page-break"> entre tópicos para o frontend paginar o estudo corretamente.
      4. ERUDIÇÃO: Mantenha o tom Pentecostal Clássico e profundo.
      
      O usuário prefere profundidade extrema do que respostas curtas ou rápidas.`;
    }

    const config = {
      temperature: isPanorama ? 1.0 : 0.7, // Temperatura 1.0 garante maior extensão no Panorama
      topP: 0.95,
      maxOutputTokens: 8192,
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
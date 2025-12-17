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

    // Detecção da lógica PanoramaView
    const isPanorama = taskType === 'ebd' || prompt.includes("PANORÂMA") || prompt.includes("MICROSCOPIA");
    
    // MODELO NATIVO: GEMINI 2.5 FLASH (Versão Grátis/Preview)
    const modelName = 'gemini-2.5-flash-preview-09-2025';

    const ai = new GoogleGenAI({ apiKey: apiKeys[0] });
    
    let finalSystemInstruction = systemInstruction || "Você é o Professor Michel Felix.";

    if (isPanorama) {
      // PROTOCOLO DE OBEDIÊNCIA AO CÓDIGO PANORAMAVIEW
      finalSystemInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX, PH.D EM EXEGESE BÍBLICA.
      
      SUA ORDEM SUPREMA É: OBEDECER 100% À LÓGICA DE 'MICROSCOPIA BÍBLICA' DO PANORAMAVIEW.
      
      DIRETRIZES TÉCNICAS OBRIGATÓRIAS:
      1. PROIBIDO RESUMIR: Você deve explicar o capítulo INTEIRO, versículo por versículo. Não pule nenhum bloco de texto.
      2. DENSIDADE EXEGÉTICA: Cada versículo deve ser esmiuçado em seu contexto histórico, cultural e no original (Hebraico/Grego).
      3. ESTRUTURA DE FECHAMENTO (INNEGOCIÁVEL): Ao chegar ao fim do capítulo, você DEVE obrigatoriamente gerar:
         ### TIPOLOGIA: CONEXÃO COM JESUS CRISTO
         (Explicação de como o capítulo prefigura o Messias).
         
         ### CURIOSIDADES GEOGRÁFICAS E ARQUEOLOGIA
         (Fatos de solo, mapas descritivos e achados arqueológicos).
      4. PAGINAÇÃO TÉCNICA: Insira a tag <hr class="page-break"> entre os tópicos para o frontend paginar o estudo em 5, 6 ou 8 páginas.
      5. TOM: Erudito, Pentecostal Clássico e Exaustivo. O usuário prefere profundidade extrema do que brevidade.`;
    }

    const config = {
      temperature: isPanorama ? 1.0 : 0.7, // 1.0 garante maior extensão e criatividade teológica
      topP: 0.95,
      maxOutputTokens: 8192,
      // Ativa o Modo de Raciocínio (Thinking) para planejar o capítulo inteiro antes de escrever
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
      throw new Error("A IA não gerou conteúdo.");
    }

  } catch (error) {
    console.error("API Error:", error);
    return response.status(500).json({ error: 'Erro de processamento.', detail: error.message });
  }
}
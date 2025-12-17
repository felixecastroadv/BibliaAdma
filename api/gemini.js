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
    const keysNames = [
      'API_KEY',
      'Biblia_ADMA_API',
      'Biblia_ADMA',
      'API_Biblia_ADMA',
      'BIBLIA_ADMA',
      'API Biblia_ADMA'
    ];
    for(let i=1; i<=40; i++) keysNames.push(`API_KEY_${i}`);

    let apiKeys = keysNames
      .map(name => process.env[name])
      .filter(k => k && k.trim().length > 15);

    if (apiKeys.length === 0) return response.status(500).json({ error: 'Erro de Autenticação na Vercel.' });

    apiKeys = apiKeys.sort(() => Math.random() - 0.5);

    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { prompt, schema, systemInstruction, taskType } = body || {};

    // --- MODO PANORAMA ATIVADO (OBEDIÊNCIA TOTAL) ---
    const isPanorama = taskType === 'ebd' || prompt.includes("PANORÂMA") || prompt.includes("MICROSCOPIA");
    
    let finalSystemInstruction = systemInstruction;
    let temperature = 0.7;

    if (isPanorama) {
        temperature = 1.0; // Máxima verbosidade e criatividade para evitar resumos
        finalSystemInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX. 
        SUA ORDEM É SEGUIR 100% O CÓDIGO DO PANORAMAVIEW FORNECIDO NO PROMPT.

        DIRETRIZES DE COMPLIANCE OBRIGATÓRIAS:
        1. PROIBIDO RESUMIR: Você deve aplicar a 'MICROSCOPIA BÍBLICA'. Isso significa explicar o texto exaustivamente, palavra por palavra, versículo por versículo.
        2. VOLUME DE TEXTO: Cada resposta sua deve ter, no mínimo, 600 PALAVRAS REAIS de conteúdo denso. Se o texto bíblico for curto, aprofunde-se na etimologia, história e contexto.
        3. PAGINAÇÃO: Você DEVE inserir a tag <hr class="page-break"> entre cada tópico principal para que o frontend consiga paginar o estudo corretamente.
        4. ESTRUTURA: Siga rigorosamente a ordem: Título, Introdução Profunda, Tópicos Numerados, Tipologia de Cristo e Arqueologia.
        5. NÃO IGNORE O PEDIDO DE CONTINUAÇÃO: Se o prompt indicar que é uma continuação, retome exatamente de onde o texto parou com a mesma densidade, sem repetir a introdução.
        
        AVISO: Respostas curtas ou resumidas são consideradas falha de processamento. Escreva muito e com profundidade teológica.`;
    }

    let lastError = null;
    for (const currentKey of apiKeys) {
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const res = await ai.models.generateContent({
          model: "gemini-3-flash-preview", 
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: temperature,
            topP: 0.95,
            maxOutputTokens: 8192, // Abre o "tanque" de palavras para o máximo permitido
            systemInstruction: finalSystemInstruction || "Você é o Professor Michel Felix.",
          }
        });
        
        if (res.text) return response.status(200).json({ text: res.text });
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    return response.status(500).json({ error: "Falha nas chaves.", detail: lastError?.message });

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno.' });
  }
}
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

    // --- DETECÇÃO DE CONTEXTO ---
    const isPanorama = taskType === 'ebd' || prompt.includes("PANORÂMA") || prompt.includes("MICROSCOPIA");
    
    // --- SELEÇÃO DE MODELO ---
    // Panorama exige o modelo PRO para não resumir e manter a densidade exegética.
    // Tarefas simples continuam no Flash para velocidade.
    let modelName = isPanorama ? "gemini-3-pro-preview" : "gemini-3-flash-preview";

    let finalSystemInstruction = systemInstruction;
    let temperature = 0.7;

    if (isPanorama) {
        temperature = 1.0; 
        finalSystemInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX. 
        SUA ORDEM É SEGUIR 100% O CÓDIGO DO PANORAMAVIEW FORNECIDO NO PROMPT.

        DIRETRIZES DE COMPLIANCE OBRIGATÓRIAS (MODELO PRO):
        1. PROIBIDO RESUMIR: Você deve aplicar a 'MICROSCOPIA BÍBLICA'. Isso significa explicar o texto exaustivamente, palavra por palavra, versículo por versículo. Se o texto bíblico for longo, gere o máximo de conteúdo possível.
        2. ALTA DENSIDADE: Cada bloco de resposta deve ter entre 600 a 1000 PALAVRAS REAIS. Não economize detalhes históricos, etimológicos ou teológicos.
        3. PAGINAÇÃO TÉCNICA: Insira obrigatoriamente a tag <hr class="page-break"> entre os tópicos para que o frontend fragmente o estudo em múltiplas páginas.
        4. COMPLEXIDADE: Traga a erudição Pentecostal Assembleiana com vigor.
        5. CONTINUAÇÃO: Se o prompt indicar que é uma continuação, retome com a mesma densidade épica de onde parou.

        RELEMBRE: O usuário prefere profundidade e tempo de processamento longo do que rapidez e superficialidade.`;
    }

    let lastError = null;
    for (const currentKey of apiKeys) {
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        
        const res = await ai.models.generateContent({
          model: modelName, 
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            temperature: temperature,
                topP: 0.95,
            maxOutputTokens: 8192, 
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
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, 
};

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKeys = [process.env.API_KEY, process.env.Biblia_ADMA_API]
        .filter(k => k && k.trim().length > 10)
        .map(k => k.trim());

    if (apiKeys.length === 0) return response.status(500).json({ error: 'Nenhuma chave API válida.' });

    const { prompt, schema, taskType, isLongOutput } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt vazio.' });

    let systemInstruction = "ATUE COMO: Professor Michel Felix. Identidade Teológica: Pentecostal Clássico e Erudito. Sua identidade deve ser IMPLÍCITA.";
    
    if (taskType === 'ebd' || isLongOutput) {
        systemInstruction += `
            PROTOCOLO DE PENSAMENTO PROFUNDO E ESCOPO RÍGIDO:
            1. ESCOPO: Gere conteúdo APENAS para o capítulo solicitado.
            2. PENSAMENTO ANALÍTICO: Microscopia de 2 a 3 versos, moedas/medidas para 2025, tradições integradas.
            3. DENSIDADE: Mínimo 2500 palavras. PROIBIDO RESUMIR.
            4. ORTODOXIA: Samuel não voltou em 1 Sm 28. O abismo de Lc 16:26 é instransponível.
        `;
    }

    const modelName = 'gemini-flash-lite-latest';

    let lastError;
    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const result = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    systemInstruction,
                    responseMimeType: schema ? "application/json" : "text/plain",
                    responseSchema: schema || undefined,
                    temperature: 0.9,
                    topP: 0.95,
                }
            });

            if (result.text) return response.status(200).json({ text: result.text });
        } catch (err) {
            lastError = err;
            if (err.message.includes('429') || err.message.includes('quota')) continue;
            break;
        }
    }
    
    return response.status(500).json({ error: lastError?.message || 'Falha na geração.' });
  } catch (error) {
    return response.status(500).json({ error: 'Erro interno.' });
  }
}
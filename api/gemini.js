import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, // Timeout de 5 minutos para densidade Magnum Opus
};

/**
 * EXECUTOR MAGISTRAL ADMA v82.0 - PROTOCOLO DE ALTA DENSIDADE & ESCOPO ÚNICO
 * Modelo: gemini-flash-lite-latest (Gemini 2.5 Lite Gratuito)
 * OBJETIVO: Garantir 2500+ palavras e obediência total ao PanoramaView.
 */
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

    for (let i = 1; i <= 50; i++) {
        const val = process.env[`API_KEY_${i}`];
        if (val && val.trim().length > 10) apiKeys.push(val.trim());
    }
    
    if (apiKeys.length === 0) return response.status(500).json({ error: 'Nenhuma chave API válida.' });

    const { prompt, schema, taskType, isLongOutput } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt vazio.' });

    // --- SYSTEM INSTRUCTION: PROTOCOLO PENSANTE v82 ---
    let systemInstruction = "ATUE COMO: Professor Michel Felix. Identidade Teológica: Pentecostal Clássico e Erudito. Sua identidade deve ser IMPLÍCITA.";
    
    if (taskType === 'ebd' || isLongOutput) {
        systemInstruction += `
            PROTOCOLO DE PENSAMENTO PROFUNDO E ESCOPO RÍGIDO:
            1. ESCOPO: Gere conteúdo APENAS para o capítulo solicitado. É PROIBIDO iniciar o capítulo seguinte.
            2. PENSAMENTO ANALÍTICO: Antes de redigir, realize o check-in de cada regra:
               - Análise geográfica e cronológica concluída?
               - Fracionamento microscópico de 2 a 3 versos garantido?
               - Moedas e medidas convertidas para 2025?
               - Documentos e tradições (Midrash) integrados?
            3. DENSIDADE: Mínimo 2500 palavras. PROIBIDO RESUMIR. Extraia cada detalhe do texto.
            4. ORTODOXIA: Samuel não voltou em 1 Sm 28. O abismo de Lc 16:26 é instransponível.
        `;
    }

    const modelName = 'gemini-flash-lite-latest';

    let lastError;
    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            const generationConfig = {
                systemInstruction,
                responseMimeType: schema ? "application/json" : "text/plain",
                responseSchema: schema || undefined,
                temperature: 0.9, // Aumentado para favorecer a expansão textual
                topP: 0.95,
                maxOutputTokens: 8192,
            };

            const responseContent = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: generationConfig
            });

            if (responseContent.text) return response.status(200).json({ text: responseContent.text });
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

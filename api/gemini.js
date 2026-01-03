
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, 
};

/**
 * EXECUTOR MAGISTRAL ADMA v102.5 - FIDELIDADE TOTAL & CALIBRAGEM DE VOLUME
 * Foco: Meta estrita de 2500-2700 palavras e exegese microscópica real.
 * Integrado ao Google Studio IA (Gemini SDK)
 */
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    // API key must be obtained exclusively from the environment variable process.env.API_KEY.
    if (!process.env.API_KEY) {
      return response.status(500).json({ error: 'Erro de Configuração: Nenhuma chave API válida encontrada.' });
    }

    const { prompt, schema, taskType, isLongOutput } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório.' });

    // --- SYSTEM INSTRUCTION: A MENTE DO PROF. MICHEL FELIX v102.5 ---
    let systemInstruction = "ATUE COMO: Professor Michel Felix. Identidade Teológica: Pentecostal Clássico, Erudito, Assembleiano e Arminiano.";
    
    if (taskType === 'ebd' || isLongOutput) {
        systemInstruction += `
            PROTOCOLO MAGNUM OPUS v102.5 (AUDITORIA EXEGÉTICA E CALIBRAGEM):
            
            1. REGRAS DE VOLUME (CRÍTICO): Sua meta é produzir EXATAMENTE entre 2500 e 2700 PALAVRAS. Se o capítulo for curto, aprofunde a exegese semântica e histórica para atingir o volume. Não ultrapasse 2800 palavras de forma alguma.
            2. REGRAS DE CONTEÚDO (FIDELIDADE TOTAL):
               - INTENÇÃO AUTORAL: Explique a real intenção do autor ao escrever e como os ouvintes originais entenderam.
               - IDIOMAS ORIGINAIS: Use termos em Hebraico/Grego com grafia original e transliteração.
               - GEOGRAFIA E ONOMÁSTICA: Explique o significado de nomes e a relevância geográfica.
               - RITUAIS E COSTUMES: Desvende rituais e expressões culturais de forma profunda.
               - PÉROLAS DE OURO: Use Midrash/Talmud criticamente para contextualização histórica.
            3. FORMATAÇÃO: Sem LaTeX ($$). Use Português Puro. 
            4. BLINDAGEM: Protocolo 1 Sm 28 e Lc 16:26 ativos conforme o contexto.
        `;
    }

    const modelName = 'gemini-3-pro-preview'; 

    try {
        // Create a new GoogleGenAI instance right before making an API call to ensure it uses the up-to-date key.
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const generationConfig = {
            systemInstruction,
            responseMimeType: schema ? "application/json" : "text/plain",
            responseSchema: schema || undefined,
            temperature: 0.7,
            topP: 0.9,
        };

        // If setting maxOutputTokens, you must also set thinkingConfig.thinkingBudget.
        if (taskType === 'ebd' || isLongOutput) {
            generationConfig.maxOutputTokens = 8192;
            generationConfig.thinkingConfig = { thinkingBudget: 4096 };
        }

        // Call generateContent with both model name and prompt/contents.
        const responseContent = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: generationConfig
        });

        // Directly return the generated text output via the .text property.
        if (responseContent.text) {
            return response.status(200).json({ text: responseContent.text });
        }
    } catch (err) {
        return response.status(500).json({ error: err.message || 'Falha na geração Magnum Opus.' });
    }
    
    return response.status(500).json({ error: 'Falha na geração Magnum Opus.' });
  } catch (error) {
    console.error("Erro Crítico no Servidor de IA:", error);
    return response.status(500).json({ error: 'Erro crítico interno.' });
  }
}

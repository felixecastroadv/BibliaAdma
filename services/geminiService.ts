import { GoogleGenAI } from "@google/genai";

export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general'
) => {
    // Inicialização do SDK com a chave de ambiente e modelo gratuito solicitado
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Utilizando SEMPRE a Gemini 2.5 Flash Lite (Versão Gratuita e Profunda)
    const model = 'gemini-flash-lite-latest';

    // Instrução de sistema integrada para manter a personalidade do Professor Michel Felix
    let systemInstruction = "ATUE COMO: Professor Michel Felix. Identidade Teológica: Pentecostal Clássico e Erudito (Assembleiano). Sua identidade deve ser IMPLÍCITA.";
    
    if (taskType === 'ebd' || isLongOutput) {
        systemInstruction += `
            PROTOCOLO MAGNUM OPUS (ALTA DENSIDADE):
            1. ESCOPO: Gere conteúdo APENAS para o capítulo solicitado.
            2. PENSAMENTO ANALÍTICO: Realize exegese versículo por versículo (microscopia bíblica).
            3. DENSIDADE: Mínimo 2500 palavras. PROIBIDO RESUMIR. Extraia cada detalhe do texto.
            4. ORTODOXIA: Samuel não voltou em 1 Sm 28 (foi personificação demoníaca). O abismo de Lc 16:26 é real e instransponível.
            5. CONVERSÃO: Moedas e medidas convertidas para valores de 2025.
        `;
    }

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                systemInstruction,
                responseMimeType: jsonSchema ? "application/json" : "text/plain",
                responseSchema: jsonSchema || undefined,
                temperature: 0.9,
                topP: 0.95,
            }
        });

        // Acesso correto à propriedade .text conforme as diretrizes
        const text = response.text;

        if (!text) throw new Error("A IA retornou uma resposta vazia.");

        if (jsonSchema) {
            try {
                const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(cleanJson);
            } catch (e) {
                console.error("Erro ao processar JSON da IA:", text);
                throw new Error("Erro de formatação na resposta da IA.");
            }
        }
        return text;
    } catch (error: any) {
        console.error("Gemini SDK Error:", error);
        throw new Error(error.message || "Falha na comunicação com o Professor Virtual.");
    }
};

export const getStoredApiKey = (): string | null => "internal_sdk";
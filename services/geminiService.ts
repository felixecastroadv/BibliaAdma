import { GoogleGenAI } from "@google/genai";

export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general'
) => {
    // Inicialização do SDK conforme diretrizes
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Seleção de modelo baseada na complexidade da tarefa
    const model = (taskType === 'ebd' || isLongOutput) ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    // Instrução de sistema integrada para manter a personalidade do Professor Michel Felix
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

    try {
        const result = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: jsonSchema ? "application/json" : "text/plain",
                responseSchema: jsonSchema || undefined,
                temperature: 0.9,
                topP: 0.95,
            }
        });

        // Acessando a propriedade .text do resultado conforme as diretrizes
        const text = result.text;

        if (!text) throw new Error("A IA retornou uma resposta vazia.");

        if (jsonSchema) {
            try {
                // Limpeza básica para garantir que o JSON seja parseado corretamente
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
export const setStoredApiKey = (key: string) => {}; 
export const clearStoredApiKey = () => {};
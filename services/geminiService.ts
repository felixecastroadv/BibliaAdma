import { GoogleGenAI, Type } from "@google/genai";

/**
 * SERVIÇO GEMINI AI - ADMA EDITION
 * Adaptado para as novas diretrizes do Google GenAI SDK.
 */

// Tipos de tarefas para seleção inteligente de modelo
export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general'
) => {
    try {
        // Inicialização obrigatória conforme diretrizes: process.env.API_KEY
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Seleção de modelo baseada na complexidade da tarefa
        // Tarefas de exegese (EBD/Comentário) exigem raciocínio avançado
        const modelName = (taskType === 'ebd' || taskType === 'commentary') 
            ? 'gemini-3-pro-preview' 
            : 'gemini-3-flash-preview';

        const config: any = {
            temperature: 0.5, 
            topP: 0.95,
            topK: 40,
        };

        // Configuração de Resposta Estruturada (JSON)
        if (jsonSchema) {
            config.responseMimeType = "application/json";
            config.responseSchema = jsonSchema;
        }

        // Configuração de Pensamento (Thinking) para modelos Gemini 3 em tarefas complexas
        if (taskType === 'ebd' || taskType === 'commentary') {
            config.thinkingConfig = { thinkingBudget: 32768 }; // Máximo para Pro
        }

        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ parts: [{ text: prompt }] }],
            config: config
        });

        const text = response.text;
        if (!text) throw new Error("A IA retornou uma resposta vazia.");

        if (jsonSchema) {
            try {
                // O SDK já tenta garantir JSON válido com responseSchema, mas fazemos o parse final
                return JSON.parse(text);
            } catch (e) {
                console.error("Erro ao processar JSON:", text);
                throw new Error("Erro de formatação na resposta da IA.");
            }
        }

        return text;

    } catch (error: any) {
        console.error("Gemini SDK Error:", error);
        throw new Error(error.message || "Falha na comunicação com o Professor Virtual.");
    }
};

// Helpers de compatibilidade mantidos
export const getStoredApiKey = (): string | null => process.env.API_KEY || null;
export const setStoredApiKey = (key: string) => {}; 
export const clearStoredApiKey = () => {};

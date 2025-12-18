
import { GoogleGenAI } from "@google/genai";

const STORAGE_KEY_API = 'adma_temp_api_key';

export const getStoredApiKey = (): string | null => {
  return localStorage.getItem(STORAGE_KEY_API);
};

function processResponse(text: string | undefined, jsonSchema: any) {
    if (!text) throw new Error("A IA retornou uma resposta vazia.");
    
    if (jsonSchema) {
      let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleanText);
      } catch (e) {
        throw new Error("Erro de formatação JSON.");
      }
    }
    return text;
}

export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general',
  systemInstruction?: string
) => {
    try {
        const isPanorama = taskType === 'ebd' || prompt.includes('PANORÂMA') || prompt.includes('MICROSCOPIA');
        const adminKey = getStoredApiKey();
        const model = 'gemini-2.5-flash-preview-09-2025';

        if (adminKey) {
            const ai = new GoogleGenAI({ apiKey: adminKey });
            const thinkingBudget = isPanorama ? 24576 : 0;
            const responseTokens = 8192;
            
            const response = await ai.models.generateContent({
                model: model,
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    temperature: isPanorama ? 1.0 : 0.7,
                    maxOutputTokens: thinkingBudget + responseTokens,
                    systemInstruction: systemInstruction || "Você é o Professor Michel Felix.",
                    ...(thinkingBudget > 0 ? { thinkingConfig: { thinkingBudget } } : {}),
                    ...(jsonSchema ? { responseMimeType: "application/json", responseSchema: jsonSchema } : {})
                }
            });
            return processResponse(response.text, jsonSchema);
        } 
        
        const controller = new AbortController();
        const timeoutMs = isPanorama ? 300000 : 120000; 
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch('/API/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt, 
                taskType: isPanorama ? 'ebd' : taskType,
                systemInstruction
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || errData.error || `Erro ${response.status}`);
        }

        const data = await response.json();
        return processResponse(data.text, jsonSchema);

    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error("O tempo de resposta excedeu o limite. Tente novamente.");
        }
        throw error; 
    }
};

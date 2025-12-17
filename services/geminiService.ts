
import { GoogleGenAI } from "@google/genai";

const STORAGE_KEY_API = 'adma_temp_api_key';

export const getStoredApiKey = (): string | null => {
  return localStorage.getItem(STORAGE_KEY_API);
};

export const setStoredApiKey = (key: string) => {
  localStorage.setItem(STORAGE_KEY_API, key);
};

export const clearStoredApiKey = () => {
  localStorage.removeItem(STORAGE_KEY_API);
};

function processResponse(text: string | undefined, jsonSchema: any) {
    if (!text) throw new Error("A IA retornou uma resposta vazia.");
    
    if (jsonSchema) {
      let cleanText = text || "{}";
      cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleanText);
      } catch (e) {
        console.error("JSON Parse Error. Raw text:", text);
        throw new Error("Erro de formatação da IA. Tente novamente (JSON inválido).");
      }
    }
    return text;
}

export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general'
) => {
    try {
        const adminKey = getStoredApiKey();
        
        if (adminKey) {
            const ai = new GoogleGenAI({ apiKey: adminKey });
            const config: any = {
                temperature: 0.7, 
                topP: 0.95,
                topK: 40,
            };

            if (jsonSchema) {
                config.responseMimeType = "application/json";
                config.responseSchema = jsonSchema;
            }

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-latest",
                contents: [{ parts: [{ text: prompt }] }],
                config: config
            });
            
            return processResponse(response.text, jsonSchema);
        } 
        
        const controller = new AbortController();
        const timeoutMs = 300000; 
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt, 
                schema: jsonSchema, 
                isLongOutput,
                taskType
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const detail = errData.error || `Status ${response.status}`;
            throw new Error(`Erro na IA: ${detail}`);
        }

        const data = await response.json();
        return processResponse(data.text, jsonSchema);

    } catch (error: any) {
        console.error("Gemini Service Error:", error);
        if (error.name === 'AbortError') {
             throw new Error("A geração demorou muito e excedeu 5 minutos.");
        }
        throw error; 
    }
};

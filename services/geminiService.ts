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
        console.error("JSON Parse Error:", text);
        throw new Error("Erro de formatação JSON. Tente novamente.");
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
        const effectiveTaskType = (prompt.includes('PANORÂMA') || prompt.includes('Panorama') || prompt.includes('MICROSCOPIA')) ? 'ebd' : taskType;
        
        const adminKey = getStoredApiKey();
        
        if (adminKey) {
            const ai = new GoogleGenAI({ apiKey: adminKey });
            const config: any = {
                temperature: effectiveTaskType === 'ebd' ? 1.0 : 0.7, 
                topP: 0.95,
                maxOutputTokens: 8192,
                systemInstruction: systemInstruction || "Você é o Professor Michel Felix."
            };

            if (jsonSchema) {
                config.responseMimeType = "application/json";
                config.responseSchema = jsonSchema;
            }

            const response = await ai.models.generateContent({
                model: effectiveTaskType === 'ebd' ? "gemini-3-pro-preview" : "gemini-3-flash-preview",
                contents: [{ parts: [{ text: prompt }] }],
                config: config
            });
            
            return processResponse(response.text, jsonSchema);
        } 
        
        const controller = new AbortController();
        const timeoutMs = 400000; // Aumentado para ~7 minutos (Processamento PRO é mais lento e denso)
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt, 
                schema: jsonSchema, 
                isLongOutput: true,
                taskType: effectiveTaskType,
                systemInstruction
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Status ${response.status}`);
        }

        const data = await response.json();
        return processResponse(data.text, jsonSchema);

    } catch (error: any) {
        console.error("Gemini Service Error:", error);
        if (error.name === 'AbortError') throw new Error("Tempo esgotado. O modelo PRO está gerando um estudo muito denso, aguarde um pouco e tente novamente.");
        throw error; 
    }
};
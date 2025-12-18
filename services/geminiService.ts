import { GoogleGenAI } from "@google/genai";

const STORAGE_KEY_API = 'adma_temp_api_key';

export const getStoredApiKey = (): string | null => localStorage.getItem(STORAGE_KEY_API);
export const setStoredApiKey = (key: string) => localStorage.setItem(STORAGE_KEY_API, key);

function processResponse(text: string | undefined, jsonSchema: any) {
    if (jsonSchema) {
      let cleanText = text || "{}";
      cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleanText);
      } catch (e) { 
        console.error("JSON Parse Error:", cleanText);
        throw new Error("IA retornou JSON inválido."); 
      }
    }
    return text;
}

export const generateContent = async (prompt: string, jsonSchema?: any) => {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
      try {
        // Usa a chave do admin se existir, senão usa a chave padrão do sistema
        const apiKey = getStoredApiKey() || process.env.API_KEY;
        if (!apiKey) throw new Error("Chave de API não configurada no ambiente.");

        const ai = new GoogleGenAI({ apiKey });
        
        const config: any = {
            temperature: 0.4,
            topP: 0.95,
            topK: 40,
        };

        if (jsonSchema) {
            config.responseMimeType = "application/json";
            config.responseSchema = jsonSchema;
        }

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview", // Modelo recomendado pela documentação para tarefas de texto
            contents: [{ parts: [{ text: prompt }] }],
            config: config
        });
        
        return processResponse(response.text, jsonSchema);

      } catch (error: any) {
        attempt++;
        const isQuotaError = error.message?.includes("429") || error.message?.includes("QUOTA");
        if (attempt >= MAX_RETRIES || !isQuotaError) throw error;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
  }
};
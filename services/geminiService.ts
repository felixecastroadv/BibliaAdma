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
      } catch (e) { throw new Error("IA retornou JSON inválido."); }
    }
    return text;
}

export const generateContent = async (prompt: string, jsonSchema?: any) => {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
      try {
        const adminKey = getStoredApiKey();
        if (adminKey) {
            const ai = new GoogleGenAI({ apiKey: adminKey });
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: [{ parts: [{ text: prompt }] }],
                config: jsonSchema ? { responseMimeType: "application/json", responseSchema: jsonSchema } : {}
            });
            return processResponse(response.text, jsonSchema);
        } 
        
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, schema: jsonSchema })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            if (response.status === 429) throw new Error("QUOTA_RETRY");
            throw new Error(err.error || "Erro na geração");
        }

        const data = await response.json();
        return processResponse(data.text, jsonSchema);

      } catch (error) {
        attempt++;
        if (attempt >= MAX_RETRIES || error.message !== "QUOTA_RETRY") throw error;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
  }
};
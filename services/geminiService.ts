
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
    if (jsonSchema) {
      let cleanText = text || "{}";
      cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleanText);
      } catch (e) {
        console.error("JSON Parse Error:", cleanText);
        throw new Error("A IA não retornou um JSON válido. Tente novamente.");
      }
    }
    return text;
}

// Tipos de tarefas para roteamento de chaves
export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general' // Novo parâmetro com default
) => {
    try {
        const adminKey = getStoredApiKey();
        
        // --- MODO CLIENTE (Chave pessoal do Admin) ---
        if (adminKey) {
            const ai = new GoogleGenAI({ apiKey: adminKey });
            const config: any = {
                temperature: 0.9, 
                topP: 0.95,
                topK: 40,
            };

            if (jsonSchema) {
                config.responseMimeType = "application/json";
                config.responseSchema = jsonSchema;
            }

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [{ parts: [{ text: prompt }] }],
                config: config
            });
            
            // Fixed: use response.text directly instead of response.response.text()
            return processResponse(response.text, jsonSchema);
        } 
        
        // --- MODO SERVER (Com Roteamento de Chaves) ---
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
                taskType // Envia o tipo para o backend escolher o pool
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Erro (${response.status}): Falha na comunicação com a IA.`);
        }

        // SE FOR STREAMING (Long Output)
        if (isLongOutput && !jsonSchema && response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                fullText += chunk;
            }
            
            if (!fullText || fullText.trim().length === 0) {
                 throw new Error("Conexão estabelecida, mas a IA não enviou texto.");
            }
            return fullText;
        }

        // SE FOR JSON PADRÃO
        const data = await response.json();
        return processResponse(data.text, jsonSchema);

    } catch (error: any) {
        console.error("Gemini Service Error:", error);
        
        if (error.name === 'AbortError') {
             throw new Error("A conexão expirou. A internet pode estar instável.");
        }
        
        const msg = error.message || "";
        if (msg.includes("429")) throw new Error("Sistema sobrecarregado. Aguarde 1 minuto.");
        
        throw new Error(msg || "Não foi possível gerar o conteúdo.");
    }
};

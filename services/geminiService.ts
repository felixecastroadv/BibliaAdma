
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

// Tipos de tarefas para roteamento de chaves
export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general'
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
            
            return processResponse(response.text, jsonSchema);
        } 
        
        // --- MODO SERVER (Com Roteamento de Chaves) ---
        const controller = new AbortController();
        const timeoutMs = 60000; // 60s timeout (razoável para user experience)
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
            // Pega a mensagem detalhada do backend se existir
            const detail = errData.error || `Status ${response.status}`;
            
            if (response.status === 503) {
                // Se tiver detalhe do erro (ex: quota), mostra ele. Senão, mensagem genérica.
                throw new Error(detail.includes('Detalhe:') ? detail : "Servidores ocupados. Tente novamente em instantes.");
            }
            if (response.status === 429) {
                throw new Error("Cota excedida. Aguarde um momento.");
            }
            throw new Error(`Erro na IA: ${detail}`);
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
                 throw new Error("A IA conectou mas não enviou resposta.");
            }
            return fullText;
        }

        // SE FOR JSON PADRÃO
        const data = await response.json();
        return processResponse(data.text, jsonSchema);

    } catch (error: any) {
        console.error("Gemini Service Error:", error);
        
        if (error.name === 'AbortError') {
             throw new Error("Tempo limite excedido. Verifique sua internet.");
        }
        
        throw error; // Repassa o erro original para o Toast
    }
};

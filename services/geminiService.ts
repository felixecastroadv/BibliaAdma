
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

// Função de espera para o Retry (Backoff)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false
) => {
  // Para tarefas longas, tentamos menos vezes para evitar esperas eternas
  const MAX_RETRIES = isLongOutput ? 2 : 3; 
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
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
        
        // --- MODO SERVER (Com Rotação de Chaves + Retry) ---
        const controller = new AbortController();
        
        // AUMENTO CRÍTICO DE TIMEOUT DO CLIENTE
        // Se for Long Output, damos 300s (5 minutos) para o servidor processar.
        // Isso impede o erro "The user aborted a request" ou timeout do fetch.
        const timeoutMs = isLongOutput ? 300000 : 30000; 
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt, schema: jsonSchema, isLongOutput: isLongOutput }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            
            if (response.status === 429 || errData.error === 'QUOTA_EXCEEDED') {
                throw new Error("QUOTA_RETRY");
            }
            if (response.status === 503) {
                 throw new Error("TIMEOUT_RETRY"); // Trata 503 como algo que vale a pena tentar de novo
            }
            
            throw new Error(errData.error || `Erro (${response.status})`);
        }

        const data = await response.json();
        return processResponse(data.text, jsonSchema);

      } catch (error: any) {
        attempt++;
        
        const isQuota = error.message === "QUOTA_RETRY" || error.message?.includes("429");
        const isTimeout = error.message === "TIMEOUT_RETRY" || error.name === 'AbortError';

        // Se for Long Task e falhou, provavelmente não vale a pena martelar muitas vezes
        if (attempt >= MAX_RETRIES) {
            if (isQuota) throw new Error("Sistema sobrecarregado (Cotas). Aguarde um momento.");
            if (isTimeout) throw new Error("A geração demorou demais e excedeu o tempo limite da conexão.");
            throw error;
        }

        if (isQuota || isTimeout) {
            const waitTime = attempt * 2000; 
            console.log(`⚠️ Tentativa ${attempt} falhou. Retentando em ${waitTime}ms...`);
            await delay(waitTime);
            continue; 
        }

        throw error;
      }
  }
};

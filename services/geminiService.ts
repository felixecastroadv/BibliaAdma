
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
  jsonSchema?: any
) => {
  const MAX_RETRIES = 3; // Tenta até 3 vezes antes de desistir
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
      try {
        const adminKey = getStoredApiKey();
        
        // --- MODO CLIENTE (Chave pessoal do Admin) ---
        // Aqui não fazemos retry complexo pois usa uma chave direta, sem rotação
        if (adminKey) {
            const ai = new GoogleGenAI({ apiKey: adminKey });
            const config: any = {
                temperature: 0.9, // Temperatura alta para criatividade
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
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout (margem para retries)

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt, schema: jsonSchema }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            
            // Tratamento de erros específicos para decidir se tenta de novo
            if (response.status === 429 || errData.error === 'QUOTA_EXCEEDED') {
                throw new Error("QUOTA_RETRY");
            }
            if (response.status === 504) {
                 throw new Error("TIMEOUT_RETRY");
            }
            if (errData.error === 'RECITATION_ERROR') {
                throw new Error("A IA bloqueou por Direitos Autorais (RECITATION). Tente pedir para 'Explicar com suas palavras' ou reduzir citações diretas.");
            }

            throw new Error(errData.error || `Erro (${response.status})`);
        }

        const data = await response.json();
        return processResponse(data.text, jsonSchema);

      } catch (error: any) {
        attempt++;
        
        const isQuota = error.message === "QUOTA_RETRY" || error.message?.includes("429");
        const isTimeout = error.message === "TIMEOUT_RETRY";

        // Se atingiu o limite de tentativas, lança o erro final para o usuário ver
        if (attempt >= MAX_RETRIES) {
            if (isQuota) throw new Error("O sistema está com alto tráfego. Aguarde 30 segundos e tente novamente.");
            if (isTimeout) throw new Error("A IA demorou muito para responder. Tente um conteúdo menor.");
            throw error;
        }

        // Se for erro de Cota ou Timeout, espera e tenta de novo (Backoff Exponencial)
        if (isQuota || isTimeout) {
            // REDUZIDO PARA 1s para ser mais ágil na troca de chaves
            const waitTime = attempt * 1000; 
            console.log(`⚠️ Tentativa ${attempt} falhou (${error.message}). Retentando em ${waitTime}ms...`);
            await delay(waitTime);
            continue; // Volta para o início do loop e tenta de novo (provavelmente pegará outra chave no servidor)
        }

        // Erros fatais (como 400 Bad Request) não devem ser retentados
        throw error;
      }
  }
};

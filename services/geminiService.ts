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

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any
) => {
  try {
    const adminKey = getStoredApiKey();
    
    // --- MODO 1: Client-Side (Chave salva no navegador - Admin/Teste Local) ---
    if (adminKey) {
        console.log("Using Client-Side API Key");
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
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: config
        });
        
        return processResponse(response.text, jsonSchema);
    } 
    
    // --- MODO 2: Server-Side (Vercel - Produção) ---
    // Adicionamos um Timeout de 15 segundos para não travar a tela
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos limite

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt, schema: jsonSchema }),
            signal: controller.signal
        });

        clearTimeout(timeoutId); // Limpa o timer se respondeu a tempo

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            
            if (response.status === 404) {
                throw new Error("API Backend não encontrada. Se estiver rodando localmente, configure a Chave no Painel Admin para usar o Modo Cliente.");
            }
            
            if (response.status === 500 && (errData.error?.includes('API_KEY') || errData.error?.includes('CONFIGURAÇÃO'))) {
                 throw new Error(errData.error);
            }

            throw new Error(errData.error || `Erro de Comunicação (${response.status})`);
        }

        const data = await response.json();
        return processResponse(data.text, jsonSchema);

    } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
            throw new Error("O servidor demorou muito para responder (Timeout). Tente novamente.");
        }
        throw fetchError;
    }

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    if (error.message?.includes("429") || error.message?.includes("Quota")) {
        throw new Error("Limite de cotas da API excedido. Use uma chave pessoal no Painel Admin.");
    }
    
    throw error;
  }
};
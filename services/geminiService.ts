/**
 * SERVIÇO GEMINI AI - ADMA EDITION
 * Adaptado para comunicação segura via proxy local.
 */

// Tipos de tarefas para seleção inteligente de modelo no servidor
export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general'
) => {
    try {
        // Envia a requisição para o endpoint local da Vercel
        // Isso evita o erro de "API Key must be set in browser" e protege as chaves
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt,
                schema: jsonSchema,
                taskType
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erro na comunicação com o servidor de IA.");
        }

        const data = await response.json();
        const text = data.text;

        if (!text) throw new Error("A IA retornou uma resposta vazia.");

        // Se houver um schema, tentamos o parse final (embora o endpoint já deva garantir)
        if (jsonSchema) {
            try {
                // Remove blocos de código se a IA os incluiu por engano
                const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return JSON.parse(cleanJson);
            } catch (e) {
                console.error("Erro ao processar JSON da IA:", text);
                throw new Error("Erro de formatação na resposta da IA.");
            }
        }

        return text;

    } catch (error: any) {
        console.error("Gemini Proxy Error:", error);
        throw new Error(error.message || "Falha na comunicação com o Professor Virtual.");
    }
};

// Helpers de compatibilidade mantidos
export const getStoredApiKey = (): string | null => "internal_proxy";
export const setStoredApiKey = (key: string) => {}; 
export const clearStoredApiKey = () => {};

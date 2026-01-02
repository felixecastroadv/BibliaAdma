export type TaskType = 'commentary' | 'dictionary' | 'devotional' | 'ebd' | 'metadata' | 'general';

export const generateContent = async (
  prompt: string, 
  jsonSchema?: any,
  isLongOutput: boolean = false,
  taskType: TaskType = 'general'
) => {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                prompt, 
                schema: jsonSchema, 
                taskType,
                isLongOutput // Informa à API que esta requisição exige densidade Magnum Opus
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Erro na comunicação com o servidor de IA.");
        }

        const data = await response.json();
        const text = data.text;

        if (!text) throw new Error("A IA retornou uma resposta vazia.");

        if (jsonSchema) {
            try {
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

export const getStoredApiKey = (): string | null => "internal_proxy";
export const setStoredApiKey = (key: string) => {}; 
export const clearStoredApiKey = () => {};
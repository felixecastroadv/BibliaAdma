
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, 
};

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKeys = [process.env.API_KEY, process.env.Biblia_ADMA_API].filter(k => k && k.length > 10);
    for (let i = 1; i <= 50; i++) {
        const val = process.env[`API_KEY_${i}`];
        if (val && val.length > 10) apiKeys.push(val);
    }
    
    if (apiKeys.length === 0) return response.status(500).json({ error: 'Nenhuma chave API configurada.' });

    const { prompt, schema, taskType } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico, Erudito e Assembleiano.";
    
    if (taskType === 'ebd') {
        systemInstruction += " TAREFA: Apostila EBD Magnum Opus. Mínimo 2400 palavras. Exegese microscópica versículo por versículo. Proibido resumir.";
    } else if (taskType === 'commentary') {
        systemInstruction += " TAREFA: Comentário exegético profundo de 3 parágrafos com referências bíblicas cruzadas.";
    }

    let lastError;
    // Utilizamos o modelo Gemini 3 Flash Preview por ser gratuito e extremamente rápido
    const modelName = 'gemini-3-flash-preview';

    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            
            const responseContent = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    systemInstruction,
                    responseMimeType: schema ? "application/json" : "text/plain",
                    responseSchema: schema || undefined,
                    // Para o plano gratuito/Flash, desabilitamos o thinkingBudget para ganhar velocidade e evitar erros de limite
                    thinkingConfig: { thinkingBudget: 0 },
                    temperature: 0.7,
                    topP: 0.95,
                }
            });

            if (responseContent.text) {
                return response.status(200).json({ text: responseContent.text });
            }
        } catch (err) {
            lastError = err;
            console.error(`Chave instável: ${key.substring(0, 8)}... - Erro:`, err.message);
            if (err.message.includes('429') || err.message.includes('quota')) continue;
            break;
        }
    }
    
    return response.status(500).json({ error: lastError?.message || 'Falha na geração com IA nativa gratuita.' });
  } catch (error) {
    return response.status(500).json({ error: 'Erro crítico no servidor de IA.' });
  }
}

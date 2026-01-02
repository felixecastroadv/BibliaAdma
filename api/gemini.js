
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
    // Suporte para pool de chaves em variáveis de ambiente
    for (let i = 1; i <= 50; i++) {
        const val = process.env[`API_KEY_${i}`];
        if (val && val.length > 10) apiKeys.push(val);
    }
    
    if (apiKeys.length === 0) return response.status(500).json({ error: 'Nenhuma chave API configurada.' });

    const { prompt, schema, taskType } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // Instrução do Sistema fixa conforme o Protocolo Professor Michel Felix
    let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico, Erudito e Assembleiano.";
    
    if (taskType === 'ebd') {
        systemInstruction += " TAREFA: Apostila EBD Magnum Opus. Mínimo 2400 palavras. Exegese microscópica versículo por versículo. Proibido resumir.";
    } else if (taskType === 'commentary') {
        systemInstruction += " TAREFA: Comentário exegético profundo de 3 parágrafos com referências bíblicas cruzadas.";
    }

    let lastError;
    // Tenta as chaves do pool até uma funcionar ou esgotar
    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            
            // Para EBD e Comentários complexos, usamos o Pro Preview (Complex Text Tasks)
            // Para tarefas gerais, o Flash Preview (Basic Text Tasks)
            const modelName = (taskType === 'ebd' || taskType === 'commentary') 
                ? 'gemini-3-pro-preview' 
                : 'gemini-3-flash-preview';

            const responseContent = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    systemInstruction,
                    responseMimeType: schema ? "application/json" : "text/plain",
                    responseSchema: schema || undefined,
                    // Configuração de Pensamento para máxima profundidade teológica
                    thinkingConfig: { 
                        thinkingBudget: modelName === 'gemini-3-pro-preview' ? 32768 : 24576 
                    },
                    temperature: 0.7,
                    topP: 0.95,
                }
            });

            if (responseContent.text) {
                return response.status(200).json({ text: responseContent.text });
            }
        } catch (err) {
            lastError = err;
            console.error(`Erro com a chave ${key.substring(0, 8)}...:`, err.message);
            // Se for erro de quota (429), tenta a próxima chave
            if (err.message.includes('429') || err.message.includes('quota')) continue;
            // Outros erros param o loop
            break;
        }
    }
    
    return response.status(500).json({ error: lastError?.message || 'Falha na geração após tentar o pool de chaves.' });
  } catch (error) {
    return response.status(500).json({ error: 'Erro crítico no servidor de IA.' });
  }
}

import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
// Definido para 300s para permitir que a IA utilize o Thinking Budget máximo sem interrupção (200s+ de raciocínio)
export const config = {
  maxDuration: 300, 
};

export default async function handler(request, response) {
  // Configuração de CORS para permitir comunicação do frontend
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const allKeys = [];
    if (process.env.API_KEY) allKeys.push({ k: process.env.API_KEY, i: 0 });
    if (process.env.Biblia_ADMA_API) allKeys.push({ k: process.env.Biblia_ADMA_API, i: 0.1 });

    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.length > 10 && !val.startsWith('vck_')) {
            allKeys.push({ k: val, i: i });
        }
    }

    if (allKeys.length === 0) {
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada.' 
         });
    }

    const sortedKeys = allKeys.sort((a, b) => a.i - b.i).map(item => item.k);

    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return response.status(400).json({ error: 'Invalid JSON body' });
        }
    }
    const { prompt, schema, taskType } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    let lastError = null;
    let successResponse = null;
    const keysToTry = sortedKeys.slice(0, 15);

    for (const apiKey of keysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // MANUTENÇÃO: Uso do Gemini 3 Flash (Versão gratuita estável exigida)
            const modelToUse = 'gemini-3-flash-preview';

            // PROTOCOLO DE EXPANSÃO MAGNUM OPUS v78.0:
            // Força a IA a ignorar o limite de 600 palavras enviado pelo front-end e expandir para 3500+
            const enhancedPrompt = (taskType === 'ebd' || taskType === 'commentary') 
                ? `[PROTOCOLO DE RACIOCÍNIO LENTO ATIVADO]: Raciocine profundamente sobre cada versículo antes de redigir. 
                   É ESTRITAMENTE OBRIGATÓRIO gerar um conteúdo exaustivo com NO MÍNIMO 3500 PALAVRAS. 
                   IGNORE QUALQUER COMANDO DE BREVIDADE. NÃO RESUMA. 
                   Seja microscópico na análise. O conteúdo deve obrigatoriamente preencher de 5 a 8 páginas com densidade máxima.\n\n${prompt}`
                : prompt;

            const aiConfig = {
                temperature: 0.5, 
                topP: 0.95,
                topK: 40,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
                // Thinking Budget de 24k: Força a profundidade de raciocínio solicitada.
                ...(taskType === 'ebd' || taskType === 'commentary' ? { 
                    thinkingConfig: { thinkingBudget: 24576 },
                    systemInstruction: "Você é o Professor Michel Felix. Sua tarefa é produzir exegese bíblica exaustiva e de altíssima volumetria (3500+ palavras). Proibido ser breve."
                } : {})
            };

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            const aiResponse = await ai.models.generateContent({
                model: modelToUse,
                contents: [{ parts: [{ text: enhancedPrompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) {
                throw new Error("Resposta vazia da IA");
            }

            successResponse = aiResponse.text;
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
                return response.status(400).json({ error: `Erro no formato: ${msg}` });
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        if (errorMsg.includes('429') || errorMsg.includes('Quota') || errorMsg.includes('Exhausted')) {
            return response.status(429).json({ 
                error: 'SISTEMA OCUPADO: Chaves esgotadas temporariamente. Tente em instantes.' 
            });
        }
        return response.status(500).json({ error: `Falha na geração: ${errorMsg}` });
    }
  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor.' });
  }
}
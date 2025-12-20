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
            const modelToUse = 'gemini-3-flash-preview';

            // --- LÓGICA DE ESPECIALIZAÇÃO DO MOTOR IA v79.0 ---
            let enhancedPrompt = prompt;
            let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e Erudito.";

            if (taskType === 'ebd') {
                // PROTOCOLO EBD: VOLUMETRIA SUPREMA (Exige 5-8 páginas)
                systemInstruction = "Você é o Professor Michel Felix. TAREFA: Produzir apostila de EBD exaustiva (Magnum Opus). Meta: Mínimo de 3500 palavras. É PROIBIDO ser breve ou resumir. Use exegese microscópica em cada fragmento.";
                enhancedPrompt = `[PROTOCOLO DE RACIOCÍNIO LENTO E EXPANSÃO MÁXIMA]: 
                   Raciocine profundamente sobre cada versículo, termo original e contexto histórico antes de escrever. 
                   É ESTRITAMENTE OBRIGATÓRIO gerar um conteúdo vasto com NO MÍNIMO 3500 PALAVRAS. 
                   IGNORE QUALQUER COMANDO DE BREVIDADE. 
                   O conteúdo deve ser longo e denso o suficiente para preencher 8 páginas de estudo acadêmico.\n\n${prompt}`;
            } 
            else if (taskType === 'commentary') {
                // PROTOCOLO COMENTÁRIO: PROFUNDIDADE CIRÚRGICA (Para VersePanel)
                systemInstruction = "Você é o Professor Michel Felix. TAREFA: Exegese de versículo único. Estilo denso e acadêmico. Meta: Exatamente 3 parágrafos profundos.";
                enhancedPrompt = `[PROTOCOLO EXEGESE DE VERSÍCULO - QUALIDADE SOBRE QUANTIDADE]: 
                   Foque exclusivamente na análise microscópica do versículo atual. 
                   NÃO confunda esta tarefa com a geração de apostila EBD. 
                   Gere EXATAMENTE 3 parágrafos profundos (Cerca de 300 palavras no total). 
                   Use o tempo de raciocínio para garantir que cada frase seja teologicamente valiosa e original.\n\n${prompt}`;
            }

            const aiConfig = {
                temperature: 0.4, // Reduzido levemente para maior precisão teológica
                topP: 0.95,
                topK: 40,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
                // Thinking Budget de 24k (Máximo): Força a IA a "mastigar" o conteúdo antes de responder
                ...(taskType === 'ebd' || taskType === 'commentary' ? { 
                    thinkingConfig: { thinkingBudget: 24576 },
                    systemInstruction: systemInstruction
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
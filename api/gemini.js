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

    // Ordena chaves para garantir prioridade mas utiliza o pool completo de até 50 chaves
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
    
    // AMPLIADO: Agora verifica o pool completo de até 50 chaves em caso de erro 429
    const keysToTry = sortedKeys; 

    for (const apiKey of keysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // --- LÓGICA DE ESPECIALIZAÇÃO DO MOTOR IA v81.0 ---
            let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e Erudito.";
            let enhancedPrompt = prompt;

            if (taskType === 'ebd') {
                systemInstruction = "Você é o Professor Michel Felix. TAREFA: Produzir apostila de EBD exaustiva (Magnum Opus). Meta: Mínimo de 3500 palavras. É PROIBIDO ser breve ou resumir. Use exegese microscópica em cada fragmento.";
                enhancedPrompt = `[PROTOCOLO DE RACIOCÍNIO LENTO E EXPANSÃO MÁXIMA]: 
                   Raciocine profundamente sobre cada versículo, termo original e contexto histórico antes de escrever. 
                   É ESTRITAMENTE OBRIGATÓRIO gerar um conteúdo vasto com NO MÍNIMO 3500 PALAVRAS. 
                   IGNORE QUALQUER COMANDO DE BREVIDADE. 
                   O conteúdo deve ser longo e denso o suficiente para preencher 8 páginas de estudo acadêmico.\n\n${prompt}`;
            } 
            else if (taskType === 'commentary') {
                systemInstruction = `Você é o Professor Michel Felix. TAREFA: Exegese de versículo único.
                
                --- REGRAS DE OURO PARA CLAREZA PEDAGÓGICA (PROTOCOLO IMPLICITAMENTE) ---
                1. PROIBIÇÃO DE ARCAÍSMOS: É terminantemente proibido o uso de palavras arcaicas, termos pouco usuais ou "teologês" rebuscado que dificulte a compreensão imediata.
                2. OBJETIVO SUPREMO: Causar o efeito "Ah! Entendi!" no aluno. O texto deve ser tão cristalino que desperte o entendimento imediato mesmo em pessoas de escolaridade básica.
                3. SIMPLIFICAÇÃO: Descomplique o difícil. Use palavras diretas do cotidiano, mantendo a profundidade do conteúdo mas simplificando a forma da entrega.
                4. TERMOS TÉCNICOS: Caso precise usar um termo indispensável (ex: Soteriologia, Exegese, Teofania), você deve OBRIGATORIAMENTE colocar o significado simples entre parênteses logo em seguida.
                5. ESTILO: Magistral, denso em conteúdo, mas leve e inspirador na linguagem.
                6. ESTRUTURA: Exatamente 3 parágrafos profundos.`;

                enhancedPrompt = `[PROTOCOLO CLAREZA CRISTALINA v81.0]: 
                   Foque exclusivamente na análise microscópica do versículo atual. 
                   NÃO confunda esta tarefa com a geração de apostila EBD. 
                   Gere EXATAMENTE 3 parágrafos profundos (Cerca de 300 palavras no total). 
                   Use o tempo de raciocínio para garantir que cada frase seja teologicamente valiosa e ORIGINAL.
                   ELIMINE qualquer palavra difícil, pomposa ou arcaica que possa travar o entendimento do aluno.
                   O foco é o despertar do entendimento espiritual através da simplicidade exegética.\n\n${prompt}`;
            }

            const getGenerationConfig = (modelName) => {
                const config = {
                    temperature: 0.4,
                    topP: 0.95,
                    topK: 40,
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    ],
                    systemInstruction: systemInstruction
                };

                // Add thinking configuration for complex tasks
                if (taskType === 'ebd' || taskType === 'commentary') {
                    config.thinkingConfig = { thinkingBudget: modelName === 'gemini-3-pro-preview' ? 32768 : 24576 };
                }

                if (schema) {
                    config.responseMimeType = "application/json";
                    config.responseSchema = schema;
                }
                return config;
            };

            // Tenta primeiro o modelo PRO para máxima qualidade (EBD/Comentário)
            let modelToUse = (taskType === 'ebd' || taskType === 'commentary') ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
            let aiResponse;

            try {
                aiResponse = await ai.models.generateContent({
                    model: modelToUse,
                    contents: [{ parts: [{ text: enhancedPrompt }] }],
                    config: getGenerationConfig(modelToUse)
                });
            } catch (innerError) {
                // FALLBACK DE REDUNDÂNCIA: Se o Pro falhar por cota (429) ou indisponibilidade (404), tenta o Flash na mesma chave
                const errorText = innerError.message || '';
                if (modelToUse === 'gemini-3-pro-preview' && (errorText.includes('429') || errorText.includes('Quota') || errorText.includes('404'))) {
                    modelToUse = 'gemini-3-flash-preview';
                    aiResponse = await ai.models.generateContent({
                        model: modelToUse,
                        contents: [{ parts: [{ text: enhancedPrompt }] }],
                        config: getGenerationConfig(modelToUse)
                    });
                } else {
                    throw innerError;
                }
            }

            if (!aiResponse.text) {
                throw new Error("Resposta vazia da IA");
            }

            successResponse = aiResponse.text;
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            // Se for erro de formato (schema inválido), não adianta trocar de chave
            if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) {
                return response.status(400).json({ error: `Erro no formato: ${msg}` });
            }
            // Aguarda brevemente antes de tentar a próxima chave do pool
            await new Promise(resolve => setTimeout(resolve, 150));
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

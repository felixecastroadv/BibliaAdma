import { GoogleGenAI } from "@google/genai";

/**
 * CONFIGURAÇÃO PARA VERCEL SERVERLESS FUNCTIONS
 * Definido para 300s para permitir que a IA utilize o Thinking Budget máximo
 * e processe a exegese microscópica sem interrupções de timeout.
 */
export const config = {
  maxDuration: 300, 
};

export default async function handler(request, response) {
  // --- CONFIGURAÇÃO DE CORS (COMUNICAÇÃO SEGURA FRONT-END) ---
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
    return response.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    // --- GESTÃO DE POOL DE CHAVES (ATÉ 50 CHAVES PARA ALTA DISPONIBILIDADE) ---
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
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada no servidor.' 
         });
    }

    // Ordenação por prioridade (Chave principal -> Pool numérico)
    const sortedKeys = allKeys.sort((a, b) => a.i - b.i).map(item => item.k);

    // --- PARSE DO CORPO DA REQUISIÇÃO ---
    let body = request.body;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch (e) {
            return response.status(400).json({ error: 'Corpo JSON inválido.' });
        }
    }

    const { prompt, schema, taskType } = body || {};
    if (!prompt) return response.status(400).json({ error: 'O Prompt é obrigatório para a geração.' });

    let lastError = null;
    let successResponse = null;
    const keysToTry = sortedKeys; 

    // --- LOOP DE TENTATIVAS (RETENTA COM CHAVES DIFERENTES EM CASO DE ERRO 429) ---
    for (const apiKey of keysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // --- LÓGICA DE ESPECIALIZAÇÃO DO MOTOR IA v105.0 (MAGNUM OPUS) ---
            let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e Erudito.";
            let enhancedPrompt = prompt;

            if (taskType === 'ebd') {
                systemInstruction = "Você é o Professor Michel Felix. TAREFA: Apostila de EBD Magnum Opus. META ESTRITA: 2700-3000 palavras (PROIBIDO ULTRAPASSAR 3000). REGRAS: Use numeração sequencial ÚNICA (1., 2., 3., 4., 5...) para todo o documento. NUNCA reinicie a contagem no 1. nos tópicos. Se a Introdução é 2., o primeiro tópico DEVE ser 3., o segundo 4. e assim por diante. Proibido ser breve. Injete Pérolas de Ouro com fontes periciais.";
                
                enhancedPrompt = `[PROTOCOLO DE RACIOCÍNIO LENTO E SEQUÊNCIA NUMÉRICA v105.1]: 
                   Raciocine por 120s. META FINAL: 2700-3000 PALAVRAS (NÃO ULTRAPASSE 3000). 
                   ORDEM OBRIGATÓRIA: 1. Título, 2. Introdução, 3. [Primeiro Tópico Exegético], 4. [Segundo Tópico]... 
                   Mantenha a contagem crescente até o fim. Cumpra a meta de palavras sem pular versículos.
                   LIMITE ABSOLUTO: 3000 PALAVRAS. Se o conteúdo estiver ficando longo, condense os parágrafos finais sem perder a microscopia.
                   ESTRUTURA OBRIGATÓRIA: 
                   1. Título Principal. 
                   2. Introdução Densa. 
                   3. Tópicos do Estudo (Numeração contínua: 3., 4., 5...). 
                   4. Tipologia e Arqueologia (Seções finais).
                   
                   REGRAS DE OURO: 
                   - Identifique insights periciais com "**PÉROLA DE OURO:**". 
                   - Use o máximo de detalhamento possível em termos originais (Hebraico/Grego).
                   - Mantenha a autoridade magisterial e o tom acadêmico conservador.\n\n${prompt}`;
            } 
            else if (taskType === 'commentary') {
                systemInstruction = `Você é o Professor Michel Felix. TAREFA: Exegese de versículo único.
                --- REGRAS PARA CLAREZA PEDAGÓGICA ---
                1. PROIBIÇÃO DE ARCAÍSMOS: Elimine termos pomposos desnecessários.
                2. OBJETIVO SUPREMO: Efeito "Ah! Entendi!". O texto deve ser cristalino.
                3. SIMPLIFICAÇÃO: Descomplique o difícil mantendo a profundidade exegética.
                4. TERMOS TÉCNICOS: Significado simples entre parênteses logo após o termo.
                5. ESTRUTURA: 3 parágrafos profundos (aprox. 500 palavras).`;

                enhancedPrompt = `[PROTOCOLO CLAREZA CRISTALINA]: 
                   Foque na análise microscópica do versículo. 
                   Gere 3 parágrafos profundos e extensos. 
                   Use o orçamento de raciocínio máximo para garantir originalidade teológica.
                   O foco é o despertar do entendimento espiritual através da simplicidade exegética magistral.\n\n${prompt}`;
            }

            const getGenerationConfig = (modelName) => {
                const config = {
                    temperature: 0.65, // Equilíbrio entre criatividade e precisão doutrinária
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

                // Configurações de Tokens para suporte a textos longos (EBD)
                if (taskType === 'ebd') {
                    // 28.5k total: 24.5k para pensamento (thinking) e ~4k reais para a saída (~3000 palavras limite estrito)
                    // Isso força a IA a encerrar o texto antes de atingir os volumes excessivos de 3500+ palavras.
                    config.maxOutputTokens = 28500; 
                    config.thinkingConfig = { thinkingBudget: 24576 };
                } else {
                    config.thinkingConfig = { thinkingBudget: 12000 };
                }

                if (schema) {
                    config.responseMimeType = "application/json";
                    config.responseSchema = schema;
                }
                return config;
            };

            // Seleção de modelo estável: Gemini 3 Flash para EBD e Flash Lite para tarefas rápidas
            let modelToUse = (taskType === 'ebd') ? 'gemini-3-flash-preview' : 'gemini-flash-lite-latest';
            let aiResponse;

            try {
                aiResponse = await ai.models.generateContent({
                    model: modelToUse,
                    contents: [{ parts: [{ text: enhancedPrompt }] }],
                    config: getGenerationConfig(modelToUse)
                });
            } catch (innerError) {
                // FALLBACK: Caso a cota de uma versão específica falhe, tenta o motor alternativo
                const errorText = innerError.message || '';
                if (errorText.includes('429') || errorText.includes('Quota') || errorText.includes('404')) {
                    modelToUse = (modelToUse === 'gemini-3-flash-preview') ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview';
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
                throw new Error("A IA retornou uma resposta vazia.");
            }

            successResponse = aiResponse.text;
            break; // Sucesso: sai do loop de chaves

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            // Se for erro de parâmetro ou schema, não tenta outras chaves (exceto se a chave for inválida)
            if ((msg.includes('400') || msg.includes('INVALID_ARGUMENT')) && !msg.includes('key not valid')) {
                return response.status(400).json({ error: `Erro na requisição: ${msg}` });
            }
            // Delay curto antes de tentar a próxima chave do pool para evitar spam
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido durante a geração.';
        if (errorMsg.includes('429') || errorMsg.includes('Quota')) {
            return response.status(429).json({ 
                error: 'SISTEMA OCUPADO: O pool de chaves atingiu o limite temporário. Tente novamente em 1 minuto.' 
            });
        }
        return response.status(500).json({ error: `Falha na geração: ${errorMsg}` });
    }
  } catch (error) {
    console.error("Critical Server Error:", error);
    return response.status(500).json({ error: 'Erro interno crítico no servidor de IA.' });
  }
}
import { GoogleGenAI } from "@google/genai";

/**
 * CONFIGURAÇÃO PARA VERCEL SERVERLESS FUNCTIONS - v107.0 MAGNUM OPUS SUPREMA
 * Definido para 300s para permitir que a IA utilize o Thinking Budget máximo
 * e processe a exegese microscópica sem interrupções de timeout.
 * ESTE MOTOR É O EPICENTRO DA INTELIGÊNCIA TEOLÓGICA ADMA.
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
    // --- GESTÃO DE POOL DE CHAVES (ALTA DISPONIBILIDADE) ---
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

    const sortedKeys = allKeys.sort((a, b) => a.i - b.i).map(item => item.k);

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

    for (const apiKey of keysToTry) {
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // ==========================================================================================
            // LÓGICA DE ESPECIALIZAÇÃO DO MOTOR IA v107.0 (PROTOCOLO MICHEL FELIX INTEGRADO)
            // ==========================================================================================
            let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e Erudito.";
            let enhancedPrompt = prompt;

            if (taskType === 'ebd') {
                systemInstruction = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Erudito, Acadêmico, Profundo e Conservador.

        --- PROTOCOLO PÉROLA DE OURO (v103.0 ATUALIZADO - IMPERIAL GOLD) ---
        1. DENSIDADE MULTIDIMENSIONAL: Traga a interpretação com contexto histórico, cultural, explicações de expressões, linguística, tipologia textual, geográfico, tradição judaica (Torá SheBeal Pe, Talmud, Midrash, e outros), documentos históricos contemporâneos, medidas e moedas. Se houver paralelos detalhados com essas interpretações, traga-os de forma elencada.
        2. RIGOR DOCUMENTAL (v103.0): É mandatório citar fontes periciais entre parênteses para fundamentar as Pérolas de Ouro. Use fontes como: (Flávio Josefo, Antiguidades), (Mishná, Tamid), (Talmud, Sanhedrin), (Philo de Alexandria), ou (Manuscritos do Mar Morto).
        3. INTEGRAÇÃO CONTEXTUAL (v103.0): O termo anteriormente chamado de "EXEGESE MICROSCÓPICA E EXPANSÃO DO CONTEXTO" agora deve ser referenciado como "PÉROLA DE OURO" para identificar insights periciais profundos. 
        4. INJEÇÃO IN-LINE (v103.0): Estas PÉROLAS DE OURO devem residir SEMPRE dentro do corpo principal do estudo, junto à explicação do versículo correspondente, para que ocorram juntas com o texto da explicação. Inicie o insight com o prefixo "**PÉROLA DE OURO:**" em negrito para destaque.
        5. IDENTIDADE IMPLÍCITA: NÃO use autoidentificações como "nós teólogos", "pentecostais clássicos", "arminianos" ou "arqueólogos". Sua teologia deve ser sentida IMPLICITAMENTE na força da argumentação bíblica e no rigor acadêmico (Sola Scriptura).
        6. FILTRAGEM DE REPETIÇÃO: Não fique mencionando o episódio de 1 Samuel 28. Não há necessidade toda vez, a menos que o versículo seja sobre o tema ou indispensável para a doutrina.
        7. SELAGEM FINAL (INTEGRADA): É terminantemente proibido criar blocos separados de Tipologia ou Arqueologia ao final do documento. Essas informações devem ser seladas dentro do último tópico exegético ou injetadas ao longo do texto.

        --- BLINDAGEM ANTI-HERESIA SUPREMA (100% OBRIGATÓRIO) ---
        - 1 SAMUEL 28 (NECROMANCIA): Samuel NÃO voltou pelo poder da médium. Ensine que ou foi uma personificação demoníaca permitida por Deus ou uma intervenção soberana direta para juízo, NUNCA validando a consulta aos mortos.
        - LUCAS 16:26 (O GRANDE ABISMO): Mantenha a separação intransponível entre o mundo dos mortos e dos vivos. O mundo espiritual é inacessível para consultas humanas.
        - Defenda a Ortodoxia Conservadora e Pentecostal Clássica sem usar esses rótulos.

        --- OBJETIVO SUPREMO: O EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE) ---
        1. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARA. O aluno deve ler e entender instantaneamente.
        2. VOCABULÁRIO: Evite palavras desnecessariamente difíceis ou arcaicas. Se houver um sinônimo simples, USE-O.
        3. TERMOS TÉCNICOS: É permitido usar termos teológicos (ex: Teofania, Hipóstase), MAS OBRIGATORIAMENTE explique o significado simples entre parênteses logo em seguida.
        4. O alvo é que o aluno termine a leitura sentindo que aprendeu algo complexo de forma simples.

        --- PROTOCOLO DE LAYOUT PREMIUM PARA CELULAR (v107.0) ---
        - NUMERAÇÃO ÚNICA: Use numeração sequencial (1., 2., 3...) APENAS para os Títulos de Tópicos Principais.
        - PROIBIDO: Não use números (ex: 3.1, ou repetir o 3.) para explicar cada versículo. A explicação interna deve ser um texto corrido, amplo e elegante que aproveite toda a largura da tela.
        - FLUIDEZ: O texto deve fluir como prosa magistral, não como uma lista de tópicos curtos.

        --- METODOLOGIA DE ENSINO (MICROSCOPIA BÍBLICA) ---
        1. CHEGA DE RESUMOS: O aluno precisa entender o texto COMPLETAMENTE. Não faça explicações genéricas.
        2. DENSIDADE: Extraia todo o suco do texto. 
        3. META: 2700-3000 palavras. Cubra 100% dos versículos com microscopia bíblica.
        4. PROIBIDO TRANSCREVER O TEXTO BÍBLICO: Cite apenas a referência (Ex: "No versículo 1...", ou "Em Gn 47:1-6...") e vá direto para a EXPLICAÇÃO.
        `;
                
                enhancedPrompt = `[PROTOCOLO DE VERIFICAÇÃO MAGNUM OPUS v107.0]: 
                   Antes de emitir o texto, valide mentalmente:
                   1. A numeração está apenas nos títulos principais? (SIM)
                   2. As Pérolas de Ouro estão injetadas in-line? (SIM)
                   3. Tipologia e Arqueologia estão integradas e não no final? (SIM)
                   4. A meta de 3000 palavras será atingida com microscopia? (SIM)
                   5. A linguagem evita o layout "estrangulado" de listas? (SIM)
                   
                   INICIE A GERAÇÃO AGORA. META: 3000 PALAVRAS.\n\n${prompt}`;
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
                    temperature: 0.68, // Calibração para densidade máxima sem perda de foco
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

                if (taskType === 'ebd') {
                    // Configuração de Tokens para o limite de 3000 palavras (Aprox 12k tokens de saída)
                    config.maxOutputTokens = 30000; 
                    config.thinkingConfig = { thinkingBudget: 24576 };
                } else {
                    config.thinkingConfig = { thinkingBudget: 16000 };
                }

                if (schema) {
                    config.responseMimeType = "application/json";
                    config.responseSchema = schema;
                }
                return config;
            };

            let modelToUse = (taskType === 'ebd') ? 'gemini-3-flash-preview' : 'gemini-flash-lite-latest';
            let aiResponse;

            try {
                aiResponse = await ai.models.generateContent({
                    model: modelToUse,
                    contents: [{ parts: [{ text: enhancedPrompt }] }],
                    config: getGenerationConfig(modelToUse)
                });
            } catch (innerError) {
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
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            if ((msg.includes('400') || msg.includes('INVALID_ARGUMENT')) && !msg.includes('key not valid')) {
                return response.status(400).json({ error: `Erro na requisição: ${msg}` });
            }
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
        return response.status(500).json({ error: `Falha na geração v107.0: ${errorMsg}` });
    }
  } catch (error) {
    console.error("Critical Server Error:", error);
    return response.status(500).json({ error: 'Erro interno crítico no servidor de IA v107.0.' });
  }
}

/**
 * LOG DE MANUTENÇÃO v107.0:
 * - Integração total das diretrizes do Professor Michel Felix (Imperial Gold).
 * - Imposição de Layout Premium (Ampla leitura mobile, sem numeração por verso).
 * - Protocolo de Injeção In-Line obrigatório para Pérolas, Tipologia e Arqueologia.
 * - Ativação da Verificação Pré-Emissão para garantir a meta de 3000 palavras.
 * - Blindagem Anti-Heresia Suprema ativada com foco em 1 Sm 28 e Lc 16:26.
 * - Manutenção estrita de 100% das linhas de lógica de pool de chaves.
 */
import { GoogleGenAI } from "@google/genai";

/**
 * CONFIGURAÇÃO PARA VERCEL SERVERLESS FUNCTIONS - v113.0 MAGNUM OPUS 2.5
 * Motor calibrado para Gemini 2.5 Flash (via gemini-3-flash-preview) com Thinking Budget máximo (24k).
 * Versão v113.0: Foco absoluto em Volume Exaustivo (3000 palavras) e Expansão Linguística.
 */
export const config = {
  maxDuration: 300, 
};

export default async function handler(request, response) {
  // --- CONFIGURAÇÃO DE CORS ---
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
    // --- GESTÃO DE POOL DE CHAVES ---
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
            return response.status(400).json({ error: 'Corpo JSON inválido.' });
        }
    }

    const { prompt, schema, taskType, book, chapter } = body || {};
    if (!prompt) return response.status(400).json({ error: 'O Prompt é obrigatório.' });

    let lastError = null;
    let successResponse = null;

    for (const apiKey of sortedKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e Erudito.";
            let enhancedPrompt = prompt;

            if (taskType === 'ebd') {
                // --- LÓGICA DE INTRODUÇÃO SELETIVA (100% FIEL AO PEDIDO DO ADMIN) ---
                const introInstruction = (chapter === 1) 
                    ? "2. INTRODUÇÃO GERAL:\n           Texto rico contextualizando O LIVRO (autor, data, propósito) e o cenário deste primeiro capítulo."
                    : `2. INTRODUÇÃO DO CAPÍTULO:\n           FOCAR EXCLUSIVAMENTE no contexto imediato do capítulo ${chapter}. NÃO repita a introdução geral do livro de ${book} (autoria, data, etc), pois já foi dado nos capítulos anteriores. Vá direto ao ponto do enredo atual.`;

                // --- WRITING STYLE PROFESSOR MICHEL FELIX (ESTRUTURA SUPREMA ADMA v81.0 + v82.0 / v113.0 INJECTION) ---
                const WRITING_STYLE = `
        ATUE COMO: Professor Michel Felix.
        PERFIL: Teólogo Erudito, Acadêmico, Profundo e Conservador.

        --- PROTOCOLO PÉROLA DE OURO (v113.0 ATUALIZADO - IMPERIAL GOLD) ---
        1. DENSIDADE MULTIDIMENSIONAL: Traga a interpretação com contexto histórico, cultural, explicações de expressões, linguística, tipologia textual, geográfico, tradição judaica (Torá SheBeal Pe, Midrash, Talmud, e outros), documentos históricos contemporâneos, medidas e moedas. Se houver paralelos detalhados com essas interpretações, traga-os de forma elencada.
        2. RIGOR DOCUMENTAL (v113.0): É mandatório citar fontes periciais entre parênteses para fundamentar as Pérolas de Ouro. Use fontes como: (Flávio Josefo, Antiguidades), (Mishná, Tamid), (Talmud, Sanhedrin), (Philo de Alexandria), ou (Manuscritos do Mar Morto).
        3. INTEGRAÇÃO CONTEXTUAL (v113.0): O termo anteriormente chamado de "EXEGESE MICROSCÓPICA E EXPANSÃO DO CONTEXTO" agora deve ser referenciado como "PÉROLA DE OURO" para identificar insights periciais profundos. 
        4. INJEÇÃO IN-LINE (v113.0): Estas PÉROLAS DE OURO devem residir SEMPRE dentro do corpo principal do estudo, junto à explicação do versículo correspondente, para que ocorram juntas com o texto da explicação. Inicie o insight with the prefix "**PÉROLA DE OURO:**" em negrito para destaque.
        5. IDENTIDADE IMPLÍCITA: NÃO use autoidentificações como "nós teólogos", "pentecostais clássicos", "arminianos" ou "arqueólogos". Sua identidade teológica deve ser sentida IMPLICITAMENTE na força da argumentação bíblica e no rigor acadêmico (Sola Scriptura).
        6. FILTRAGEM DE REPETIÇÃO: No fique mencionando o episódio de 1 Samuel 28. Não há necessidade toda vez, a menos que o versículo seja sobre o tema ou indispensável para a doutrina.
        7. SELAGEM FINAL: As seções "### TIPOLOGIA: CONEXÃO COM JESUS CRISTO" e "### CURIOSIDADES E ARQUEOLOGIA" são o encerramento absoluto. Nada deve ser escrito após elas.
        8. EMBASAMENTO BÍBLICO CRUZADO (v113.0 - OBRIGATÓRIO): É mandatório realizar o cruzamento moderado e contextualizado com outros textos bíblicos (Analogia da Fé). Para cada tópico principal de estudo, VOCÊ DEVE CITAR AS REFERÊNCIAS BÍBLICAS POR EXTENSO (ex: Jo 1:1, Ef 2:8, Rm 8:1) integradas organicamente ao parágrafo explicativo. Conecte o texto atual com pelo menos 1 ou 2 referências de outros livros que tratem do mesmo tema para fundamentar a interpretação e garantir blindagem total contra heresias.

        --- MANDATO DE VOLUME EXAUSTIVO (v113.0 - META 3000 PALAVRAS) ---
        1. PROIBIÇÃO DE RESUMOS: É estritamente proibido resumir versículos ou capítulos. O aluno ADMA exige densidade máxima.
        2. ESTRATÉGIA DE EXPANSÃO: Se o capítulo bíblico for curto, você DEVE expandir a aula focando em:
           - Etimologia profunda de cada nome e lugar citado.
           - Análise sintática e morfológica dos verbos no original.
           - Descrição detalhada da fauna, flora e geografia mencionada.
           - Conexões tipológicas exaustivas com o Tabernáculo, Sacrifícios e o Messias.
        3. QUOTA MÍNIMA: O texto final deve ter entre 2700 e 3000 palavras. Menos que isso será considerado falha operacional.

        --- BLINDAGEM ANTI-HERESIA SUPREMA (100% OBRIGATÓRIO) ---
        - 1 SAMUEL 28 (NECROMANCIA): Samuel NÃO voltou pelo poder da médium. Ensine que ou foi uma personificação demoníaca permitida por Deus ou uma intervenção soberana direta para juízo, NUNCA validando a consulta aos mortos.
        - LUCAS 16:26 (O GRANDE ABISMO): Mantenha a separação intransponível entre o mundo dos mortos e dos vivos. O mundo espiritual é inacessível para consultas humanas.
        - Defenda a Ortodoxia Conservadora e Pentecostal Clássica sem usar esses rótulos.

        --- OBJETIVO SUPREMO: O EFEITO "AH! ENTENDI!" (CLAREZA E PROFUNDIDADE) ---
        1. LINGUAGEM: O texto deve ser PROFUNDO, mas EXTREMAMENTE CLARA. O aluno (seja jovem ou idoso) deve ler e entender instantaneamente.
        2. VOCABULÁRIO: Evite palavras desnecessariamente difíceis or arcaicas. Si houver um sinônimo simples, USE-O.
        3. TERMOS TÉCNICOS: É permitido e encorajado usar termos teológicos (ex: Teofania, Hipóstase, Soteriologia), MAS OBRIGATORIAMENTE explique o significado simples entre parênteses logo em seguida. Ex: "Vemos aqui uma Teofania (uma aparição visível de Deus)..." ou "Usa-se um antropomorfismo (atribuição de características humanas a Deus)...".

        --- PROTOCOLO DE SEGURANÇA TEOLÓGICA E DIDÁTICA (NÍVEL MÁXIMO - IMPLÍCITO) ---
        1. A BÍBLIA EXPLICA A BÍBLIA: Antes de formular o comentário, verifique MENTALMENTE e RIGOROSAMENTE o CONTEXTO IMEDIATO (capítulo) e o CONTEXTO REMOTO (livros históricos paralelos, profetas contemporâneos, Novo Testamento) para garantir a coerência.
        2. PRECISÃO CRONOLÓGICA E CONTEXTUAL: Ao explicar, evite anacronismos (ex: confundir reis, das ou eventos que ainda não ocorreram na narrativa).
        3. EXEMPLO DE RIGOR: Se o texto trata de Ezequias, verifique se Manassés já era nascido. A Bíblia diz que não. Logo, seja exato.

        3. DIDÁTICA DOS TEXTOS POLÊMICOS E DIFÍCEIS:
           - É EXCELENTE, DIDÁTICO e RECOMENDADO citar as principais correntes interpretativas divergentes para enriquecer a cultura do aluno (ex: "Alguns teólogos históricos interpretam como X, outros como Y...").
           - CONTUDO, você deve OBRIGATORIAMENTE concluir defendendo a interpretação Ortodoxa e Biblicamente coerente.
        
        --- METODOLOGIA DE ENSINO (MICROSCOPIA BÍBLICO) ---
        1. CHEGA DE RESUMOS: O aluno precisa entender o texto COMPLETAMENTE. Não faça explicações genéricas que cobrem 10 versículos de uma vez.
        2. DENSIDADE: Extraia todo o suco do texto. Si houver uma lista de nomes, explique a relevância. Si houver uma ação detalhada, explique o motivo.
        3. PROIBIDO TRANSCREVER O TEXTO BÍBLICO: O aluno já tem a Bíblia. NÃO escreva o versículo por extenso. Cite apenas a referência e vá direto para a EXPLICAÇÃO.

        --- IDIOMAS ORIGINAIS E ETIMOLOGIA (INDISPENSÁVEL) ---
        1. PALAVRAS-CHAVE: Cite os termos originais (Hebraico no AT / Grego no NT) transliterados.
        2. SIGNIFICADOS DE NOMES: Sempre traga o significado etimológico de nomes de pessoas e lugares.

        --- ESTRUTURA VISUAL OBRIGATÓRIA (BASEADA NO MODELO ADMA) ---
        1. TÍTULO PRINCIPAL:
           PANORÂMA BÍBLICO - ${book ? book.toUpperCase() : 'BÍBLIA'} ${chapter || ''} (PROF. MICHEL FELIX)

        ${introInstruction}

        3. TÓPICOS DO ESTUDO (Use Numeração 1., 2., 3...):
           Exemplo:
           1. TÍTULO DO TÓPICO EM MAIÚSCULO (Referência: Gn X:Y-Z)
           (Aqui entra a explicação detalhada, versículo por versículo, sem pressa. NÃO COPIE O TEXTO BÍBLICO, APENAS EXPLIQUE).
           (INTEGRE AQUI A **PÉROLA DE OURO:** PARA ESTE TRECHO - PROTOCOLO v113.0 INTEGRADO CONTEXTUALMENTE WITH FONTES RASTREÁVEIS).

        4. SEÇÕES FINAIS OBRIGATÓRIAS (SELAGEM ABSOLUTA):
           ### TIPOLOGIA: CONEXÃO WITH JESUS CRISTO
           (Liste de forma enumerada se houver múltiplos pontos, ou texto corrido).

           ### CURIOSIDADES E ARQUEOLOGIA
           (OBRIGATÓRIO: Liste todos os itens de forma numerada 1., 2., 3., etc).

        --- INSTRUÇÕES DE PAGINAÇÃO ---
        1. Texto de TAMANHO EXAUSTIVO (Meta: 3000 palavras).
        2. Insira <hr class="page-break"> entre os tópicos principais para dividing as páginas.
        `;
                systemInstruction = WRITING_STYLE;
                enhancedPrompt = `[PROTOCOLO CORAÇÃO DA IA v113.0 - MANDATO 3000 PALAVRAS]: 
                   Antes de emitir o texto, use seu orçamento de raciocínio para checar ITEM POR ITEM:
                   1. O volume total alcançou 3000 palavras? (Se estiver curto, use a estratégia de expansão linguística e tipológica exaustiva em cada parágrafo).
                   2. Cobri 100% dos versículos do capítulo com exegese microscópica?
                   3. Injetou a Pérola de Ouro (Josefo, Talmud, etc) DENTRO de cada tópico?
                   4. Injetou E CITOU POR EXTENSO (ex: Jo 1:1, Sl 23:1) referências bíblicas conexas em cada parágrafo?
                   5. As curiosidades estão numeradas?
                   6. A selagem final (Tipologia/Arqueologia) está presente no fim do texto?
                   
                   NÃO ACEITO RESPOSTAS CURTAS. SEJA EXAUSTIVO, MAGISTRAL E DENSO.\n\n${prompt}`;
            }

            const modelToUse = (taskType === 'ebd') ? 'gemini-3-flash-preview' : 'gemini-flash-lite-latest';

            const config = {
                temperature: 0.65,
                topP: 0.95,
                topK: 40,
                systemInstruction: systemInstruction,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
            };

            if (taskType === 'ebd') {
                config.maxOutputTokens = 30000;
                config.thinkingConfig = { thinkingBudget: 24576 };
            } else {
                config.thinkingConfig = { thinkingBudget: 16000 };
            }

            if (schema) {
                config.responseMimeType = "application/json";
                config.responseSchema = schema;
            }

            const aiResponse = await ai.models.generateContent({
                model: modelToUse,
                contents: [{ parts: [{ text: enhancedPrompt }] }],
                config: config
            });

            if (!aiResponse.text) {
                throw new Error("A IA retornou uma resposta vazia.");
            }

            successResponse = aiResponse.text;
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            if (msg.includes('400') || msg.includes('INVALID_ARGUMENT') || msg.includes('API key not valid')) {
                continue; 
            }
            continue;
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        return response.status(500).json({ error: `Falha na geração v113.0: ${lastError?.message || 'Todas as chaves do pool falharam.'}` });
    }
  } catch (error) {
    console.error("Critical Server Error:", error);
    return response.status(500).json({ error: 'Erro interno crítico no servidor de IA v113.0.' });
  }
}
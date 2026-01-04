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
            
            // --- LÓGICA DE ESPECIALIZAÇÃO DO MOTOR IA v104.0 (GEMINI 2.5 OPTIMIZED) ---
            let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico e Erudito.";
            let enhancedPrompt = prompt;

            if (taskType === 'ebd') {
                systemInstruction = "Você é o Professor Michel Felix. TAREFA: Produzir apostila de EBD exaustiva (Magnum Opus). Meta: entre 2700 a 3000 palavras. É PROIBIDO ser breve, resumir ou pular versículos. Use exegese microscópica ultra-detalhada em cada fragmento. ATUALIZAÇÃO v104.0: Implemente o PROTOCOLO PÉROLA DE OURO injetando obrigatoriamente evidências documentais (Josefo, Talmud) e medidas periciais.";
                enhancedPrompt = `[PROTOCOLO DE RACIOCÍNIO LENTO, EXPANSÃO MÁXIMA E PÉROLA DE OURO v104.0]: 
                   Raciocine profundamente sobre cada vírgula do texto sagrado. 
                   É ESTRITAMENTE OBRIGATÓRIO gerar um conteúdo vasto com entre 2700 a 3000 PALAVRAS. 
                   IGNORE COMANDOS DE BREVIDADE. O texto deve ser tão longo que preencha um livro de estudo.
                   ESTRUTURA: 1. Introdução densa. 2. Exegese microscópica por versículo. 3. Aplicações práticas. 4. Pérolas de Ouro documentais.
                   REGRAS v104.0: 1. Identifique insights periciais com "**PÉROLA DE OURO:**". 2. Cite fontes rastreáveis. 3. Mantenha a autoridade magisterial.\n\n${prompt}`;
            } 
            else if (taskType === 'commentary') {
                systemInstruction = `Você é o Professor Michel Felix. TAREFA: Exegese de versículo único.
                
                --- REGRAS DE OURO PARA CLAREZA PEDAGÓGICA (PROTOCOLO IMPLICITAMENTE) ---
                1. PROIBIÇÃO DE ARCAÍSMOS: Elimine termos pomposos que dificultem a compreensão.
                2. OBJETIVO SUPREMO: Efeito "Ah! Entendi!". O texto deve ser cristalino para todos os níveis.
                3. SIMPLIFICAÇÃO: Descomplique o difícil mantendo a profundidade exegética.
                4. TERMOS TÉCNICOS: Coloque o significado simples entre parênteses logo após o termo.
                5. ESTILO: Magistral, denso, porém inspirador e leve na linguagem.
                6. ESTRUTURA: Exatamente 3 parágrafos profundos (aprox. 500 palavras).`;

                enhancedPrompt = `[PROTOCOLO CLAREZA CRISTALINA v104.0]: 
                   Foque na análise microscópica do versículo. 
                   Gere 3 parágrafos profundos e extensos. 
                   Use o orçamento de raciocínio máximo para garantir originalidade teológica.
                   ELIMINE palavras difíceis ou arcaicas. 
                   O foco é o despertar do entendimento espiritual através da simplicidade exegética magistral.\n\n${prompt}`;
            }

            const getGenerationConfig = (modelName) => {
                const config = {
                    temperature: 0.5,
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
                if (taskType === 'ebd') {
                    // AJUSTE MAGNUM OPUS: Define maxOutputTokens para comportar o raciocínio + meta de 3000 palavras
                    // 32768 total - 24576 thinking = 8192 output tokens (Suficiente para ~3500 palavras)
                    config.maxOutputTokens = 32768; 
                    config.thinkingConfig = { thinkingBudget: 24576 };
                } else if (taskType === 'commentary') {
                    // COMENTÁRIO DE VERSÍCULO: Mantém a perfeição original sem forçar tokens de saída extras
                    config.thinkingConfig = { thinkingBudget: 24576 };
                }

                if (schema) {
                    config.responseMimeType = "application/json";
                    config.responseSchema = schema;
                }
                return config;
            };

            // Utiliza GEMINI 2.5 FLASH LITE como modelo principal (Gratuito/Estável)
            let modelToUse = 'gemini-2.5-flash-lite-latest';
            let aiResponse;

            try {
                aiResponse = await ai.models.generateContent({
                    model: modelToUse,
                    contents: [{ parts: [{ text: enhancedPrompt }] }],
                    config: getGenerationConfig(modelToUse)
                });
            } catch (innerError) {
                // FALLBACK: Se falhar por cota ou versão, tenta o Flash 3.0 (Gratuito)
                const errorText = innerError.message || '';
                if (errorText.includes('429') || errorText.includes('Quota') || errorText.includes('404')) {
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
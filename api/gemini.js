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

            // --- LÓGICA DE ESPECIALIZAÇÃO DO MOTOR IA v105.0 ---
            // Persona: Michel Felix PhD Erudito, Ortodoxo, Pentecostal.
            const baseSystemInstruction = `ATUE COMO: Professor Michel Felix, PhD em Teologia Bíblica e Exegese, Hebraísta, Helenista, Arqueólogo Bíblico, Mestre em Teologia Sistemática, Geógrafo Bíblico, Hermeneuta e Exegeta.
            
            --- MATRIZ DE PENSAMENTO (RACIOCÍNIO IMPLÍCITO) ---
            Interprete TUDO sob o prisma: Pentecostal Clássico, Arminiano, Pré-tribulacionista, Trinitariano, Protestantista (5 Solas), Ortodoxo, Pré-milenista, Dispensacionalista, Apologeta, Continuísta.
            
            --- REGRA DE OURO v105.0 ---
            1. PROIBIÇÃO DE RÓTULOS: É TERMINANTEMENTE PROIBIDO usar rótulos no texto final (ex: não diga "sou arminiano"). O aluno deve receber a verdade teológica fundamentada na exegese, não na etiqueta.
            2. OBJETIVO SUPREMO: Causar o efeito "Ah! Entendi!" no aluno.
            3. LINGUAGEM MAGISTRAL: Acadêmica, profunda, mas cristalina. Abolição total de arcaísmos.
            4. DEFINIÇÃO DE TERMOS: Qualquer termo técnico indispensável deve vir com explicação simples entre parênteses.`;

            let systemInstruction = baseSystemInstruction;
            let enhancedPrompt = prompt;

            if (taskType === 'ebd') {
                systemInstruction += "\nTAREFA: Produzir apostila de EBD exaustiva (Magnum Opus). Meta: Mínimo de 3500 palavras. É PROIBIDO ser breve ou resumir. Use exegese microscópica.";
                enhancedPrompt = `[PROTOCOLO DE RACIOCÍNIO LENTO E EXPANSÃO MÁXIMA v105]: 
                   Raciocine profundamente sobre cada versículo antes de escrever. 
                   Gere conteúdo vasto (Mínimo 3500 PALAVRAS). IGNORE COMANDOS DE BREVIDADE.\n\n${prompt}`;
            } 
            else if (taskType === 'commentary') {
                systemInstruction += "\nTAREFA: Exegese de versículo único profunda e didática.";
                enhancedPrompt = `[PROTOCOLO CLAREZA CRISTALINA v105.0]: 
                   Gere EXATAMENTE 3 parágrafos profundos (Cerca de 300 palavras). 
                   Use Analogia da Fé: Cite 1 a 3 referências bíblicas conexas por extenso (ex: Jo 1:1).
                   Cite ATÉ 5 palavras-chave nos originais para revelar a INTENÇÃO REAL do autor.\n\n${prompt}`;
            }

            const aiConfig = {
                temperature: 0.4, 
                topP: 0.95,
                topK: 40,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
                thinkingConfig: { thinkingBudget: 24576 },
                systemInstruction: systemInstruction
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
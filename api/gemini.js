import { GoogleGenAI } from "@google/genai";

// Configuração para Vercel Serverless Functions
export const config = {
  maxDuration: 300, 
};

export default async function handler(request, response) {
  // Configuração de CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    // --- 1. COLETA MASSIVA DE CHAVES (POOL) ---
    const allKeys = [];
    if (process.env.API_KEY) allKeys.push(process.env.API_KEY);
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API);

    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.length > 10) allKeys.push(val);
    }

    const validKeys = [...new Set(allKeys)].filter(k => k && !k.startsWith('vck_'));

    if (validKeys.length === 0) {
         return response.status(500).json({ 
             error: 'CONFIGURAÇÃO PENDENTE: Nenhuma Chave de API válida encontrada (API_KEY_1...50).' 
         });
    }

    // --- 2. PREPARAÇÃO DO BODY ---
    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) { return response.status(400).json({ error: 'Invalid JSON body' }); }
    }
    const { prompt, systemInstruction, taskType, schema } = body || {};
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // Detecção Panorama para garantir qualidade
    const isPanorama = taskType === 'ebd' || prompt.includes("PANORÂMA") || prompt.includes("MICROSCOPIA");
    
    // --- 3. LOOP DE ROTAÇÃO DE CHAVES (FAILOVER INTELIGENTE) ---
    const shuffledKeys = validKeys.sort(() => 0.5 - Math.random());
    
    let lastError = null;
    let successResponse = null;

    // Definição do Modelo (2.5 Flash Preview suporta Thinking para alta qualidade)
    const modelName = 'gemini-2.5-flash-preview-09-2025';

    for (const apiKey of shuffledKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // Personagem e Regras do Panorama
            let finalInstruction = systemInstruction || "Você é o Professor Michel Felix.";
            if (isPanorama) {
                finalInstruction = `VOCÊ É O PROFESSOR MICHEL FELIX, PH.D EM EXEGESE.
                REGRA DE OURO: OBEDECER 100% AO PANORAMAVIEW.
                1. PROIBIDO RESUMIR: Explique o capítulo INTEIRO, versículo por versículo.
                2. ESTRUTURA OBRIGATÓRIA: Termine SEMPRE com: ### TIPOLOGIA e ### CURIOSIDADES GEOGRÁFICAS.
                3. Use <hr class="page-break"> entre os tópicos.`;
            }

            const thinkingBudget = isPanorama ? 24576 : 0;
            const responseTokens = 8192;

            const aiConfig = {
                temperature: isPanorama ? 1.0 : 0.4,
                topP: 0.95,
                maxOutputTokens: thinkingBudget + responseTokens,
                systemInstruction: finalInstruction,
                thinkingConfig: thinkingBudget > 0 ? { thinkingBudget } : undefined,
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ],
            };

            if (schema) {
                aiConfig.responseMimeType = "application/json";
                aiConfig.responseSchema = schema;
            }

            const aiResponse = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: aiConfig
            });

            if (!aiResponse.text) throw new Error("EMPTY_RESPONSE_RETRY");

            successResponse = aiResponse.text;
            break; 

        } catch (error) {
            lastError = error;
            const msg = error.message || '';
            if (msg.includes('429') || msg.includes('Quota') || msg.includes('Too Many Requests') || msg.includes('503') || msg.includes('Overloaded')) {
                continue; 
            } else {
                break; 
            }
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const errorMsg = lastError?.message || 'Erro desconhecido.';
        return response.status(500).json({ error: `Erro na geração: ${errorMsg}`, detail: lastError?.message });
    }

  } catch (error) {
    return response.status(500).json({ error: 'Erro interno crítico no servidor.' });
  }
}
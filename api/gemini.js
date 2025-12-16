
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, // Limite Vercel Hobby
  supportsResponseStreaming: true, 
};

// Função de espera apenas para erros de rede genéricos (não usada em 429)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(request, response) {
  // Configuração CORS
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    let body = request.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (e) {}
    }
    const { prompt, schema, isLongOutput } = body || {};

    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- 1. COLETA TODAS AS CHAVES EM UMA LISTA ÚNICA ---
    // Removemos a separação por tipo para maximizar a disponibilidade
    let allKeys = [];

    // Chaves numeradas
    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.trim().length > 20) {
            allKeys.push(val.trim());
        }
    }

    // Chaves extras
    if (process.env.API_KEY) allKeys.push(process.env.API_KEY.trim());
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API.trim());

    // Remove duplicatas
    allKeys = [...new Set(allKeys)];

    if (allKeys.length === 0) {
         return response.status(500).json({ error: 'SERVER CONFIG ERROR: Nenhuma chave de API encontrada.' });
    }

    // --- 2. LÓGICA DE ROTAÇÃO SEQUENCIAL (CARROSSEL) ---
    // Sorteia um ponto de partida para não sobrecarregar sempre a API_KEY_1
    const startIndex = Math.floor(Math.random() * allKeys.length);
    
    // Modelos: Tenta o melhor (2.5), se falhar tenta o mais rápido (1.5)
    // Se a chave falhar no 2.5, pulamos para a próxima chave tentando 2.5 de novo.
    // O fallback de modelo ocorre apenas se a chave for válida mas o modelo estiver instável.
    const PRIMARY_MODEL = "gemini-2.5-flash";
    const BACKUP_MODEL = "gemini-1.5-flash";

    let successResponse = null;
    let lastError = null;

    // Tentamos usar até 15 chaves diferentes antes de desistir (ou todas se tiver menos que 15)
    const MAX_KEY_ATTEMPTS = Math.min(allKeys.length, 15);

    // LOOP DE TENTATIVAS (ROTAÇÃO DE CHAVES)
    for (let i = 0; i < MAX_KEY_ATTEMPTS; i++) {
        // Cálculo do índice circular: (Inicio + i) % Total
        // Ex: Se tem 10 chaves e começou na 8: 8, 9, 0, 1, 2...
        const keyIndex = (startIndex + i) % allKeys.length;
        const apiKey = allKeys[keyIndex];
        
        // Alterna modelo: Nas primeiras tentativas insiste no 2.5, depois do meio tenta o 1.5
        const currentModel = i < 3 ? PRIMARY_MODEL : BACKUP_MODEL;

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            // --- MODO STREAMING (Textos Longos) ---
            if (isLongOutput && !schema) {
                const streamResult = await ai.models.generateContentStream({
                    model: currentModel,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: {
                        temperature: 0.7,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                    }
                });

                response.setHeader('Content-Type', 'text/plain; charset=utf-8');
                response.setHeader('Transfer-Encoding', 'chunked');

                for await (const chunk of streamResult) {
                    const txt = chunk.text; 
                    if (txt) response.write(txt);
                }
                
                response.end();
                return; // SUCESSO E SAI DA FUNÇÃO

            } 
            // --- MODO PADRÃO (JSON/Curto) ---
            else {
                const config = { temperature: 0.6 };
                if (schema) {
                    config.responseMimeType = "application/json";
                    config.responseSchema = schema;
                }

                const result = await ai.models.generateContent({
                    model: currentModel,
                    contents: [{ parts: [{ text: prompt }] }],
                    config: config
                });

                successResponse = result.text;
                break; // SUCESSO - SAI DO LOOP
            }

        } catch (error) {
            const errMsg = error.message || '';
            console.warn(`[Fail Key Index ${keyIndex}] Model ${currentModel}: ${errMsg.substring(0, 50)}...`);
            lastError = error;

            // ANÁLISE DO ERRO PARA DECISÃO
            const isQuota = errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('Resource has been exhausted');
            
            if (isQuota) {
                // Se for cota estourada (429), NÃO ESPERA. Pula imediatamente para a próxima chave.
                continue;
            } else {
                // Se for outro erro (ex: 503 do Google), espera um pouquinho antes de tentar outra chave
                await delay(500); 
            }
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        // Se saiu do loop sem sucesso
        const msg = lastError?.message || 'Todas as chaves falharam.';
        return response.status(503).json({ error: `Sistema ocupado. Tentamos várias conexões sem sucesso. (${msg})` });
    }

  } catch (error) {
    return response.status(500).json({ error: `Erro Interno Crítico: ${error.message}` });
  }
}

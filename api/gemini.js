
import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 60, // Limite máximo da Vercel Hobby
  supportsResponseStreaming: true, 
};

// Pequeno delay apenas para erros de rede (não usado para cota excedida)
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

    // --- 1. COLETAR TODAS AS CHAVES DISPONÍVEIS ---
    let allKeys = [];

    // Busca chaves numeradas de 1 a 50
    for (let i = 1; i <= 50; i++) {
        const keyName = `API_KEY_${i}`;
        const val = process.env[keyName];
        if (val && val.trim().length > 20) {
            allKeys.push(val.trim());
        }
    }

    // Adiciona chaves extras se existirem
    if (process.env.API_KEY) allKeys.push(process.env.API_KEY.trim());
    if (process.env.Biblia_ADMA_API) allKeys.push(process.env.Biblia_ADMA_API.trim());

    // Remove duplicatas e limpa
    allKeys = [...new Set(allKeys)];

    if (allKeys.length === 0) {
         return response.status(500).json({ error: 'SERVER CONFIG ERROR: Nenhuma chave de API configurada.' });
    }

    // --- 2. LÓGICA DE ROTAÇÃO SEQUENCIAL ---
    // Sorteia um ponto de partida para distribuir a carga
    const startIndex = Math.floor(Math.random() * allKeys.length);
    
    // Modelos
    const PRIMARY_MODEL = "gemini-2.5-flash"; // Qualidade
    const BACKUP_MODEL = "gemini-1.5-flash"; // Velocidade/Estabilidade

    let successResponse = null;
    let lastError = null;

    // Tenta usar todas as chaves disponíveis sequencialmente
    // Limitamos a 15 tentativas para não estourar o tempo limite da Vercel (60s)
    const MAX_ATTEMPTS = Math.min(allKeys.length, 15);

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        // Pega a chave atual na roda (se chegar no fim, volta pro começo)
        const keyIndex = (startIndex + i) % allKeys.length;
        const apiKey = allKeys[keyIndex];
        
        // Estratégia de Modelo: Tenta o 2.5 nas primeiras 3 chaves, depois apela para o 1.5
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
                return; // SUCESSO! Encerra a função.

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
                break; // SUCESSO! Sai do loop.
            }

        } catch (error) {
            const errMsg = error.message || '';
            console.warn(`[Falha Chave ${keyIndex}] Modelo ${currentModel}: ${errMsg.substring(0, 50)}...`);
            lastError = error;

            // Se for erro de COTA (429), NÃO ESPERE! Pule imediatamente para a próxima chave.
            const isQuotaError = errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('Exhausted');
            
            if (isQuotaError) {
                continue; // Próxima iteração imediata
            } else {
                // Se for outro erro (ex: modelo sobrecarregado), espera um pouquinho
                await delay(300);
            }
        }
    }

    if (successResponse) {
        return response.status(200).json({ text: successResponse });
    } else {
        const msg = lastError?.message || 'Todas as chaves falharam.';
        return response.status(503).json({ error: `Servidores Google ocupados. Tente novamente em 30s. (${msg})` });
    }

  } catch (error) {
    return response.status(500).json({ error: `Erro Interno: ${error.message}` });
  }
}

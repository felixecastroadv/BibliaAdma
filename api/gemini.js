import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, // Timeout estendido para 5 minutos para processar a densidade Magnum Opus
};

/**
 * EXECUTOR MAGISTRAL ADMA v79.0 - ALTA FIDELIDADE & RESILIÊNCIA
 * Este arquivo é o motor que aciona a IA Gemini 2.5 (Versão Gratuita/Lite).
 * OBJETIVO: Garantir 2500 palavras exatas, exegese microscópica e obediência total ao PanoramaView.
 */
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    // Coleta e limpa chaves de API (Prevenção de espaços vazios que causam erro de chave inválida)
    const apiKeys = [process.env.API_KEY, process.env.Biblia_ADMA_API]
        .filter(k => k && k.trim().length > 10)
        .map(k => k.trim());

    // Busca chaves adicionais no pool de 1 a 50
    for (let i = 1; i <= 50; i++) {
        const val = process.env[`API_KEY_${i}`];
        if (val && val.trim().length > 10) apiKeys.push(val.trim());
    }
    
    if (apiKeys.length === 0) return response.status(500).json({ error: 'Erro de Configuração: Nenhuma chave API válida encontrada no ambiente.' });

    const { prompt, schema, taskType, isLongOutput } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório para o executor.' });

    // --- SYSTEM INSTRUCTION: O COMANDO INABALÁVEL DO PROF. MICHEL FELIX ---
    // Esta instrução força a IA a ler e obedecer cada linha do prompt enviado pelo PanoramaView.
    let systemInstruction = "ATUE COMO: Professor Michel Felix. Identidade Teológica: Pentecostal Clássico, Erudito, Assembleiano e Arminiano. Sua identidade deve ser IMPLÍCITA.";
    
    if (taskType === 'ebd' || isLongOutput) {
        systemInstruction += `
            PROTOCOLO MAGNUM OPUS v80.0 (VERSÃO ÚNICA E PADRONIZADA):
            1. ENTREGA ÚNICA: Gere apenas UMA versão do estudo. Proibido criar "Versão 1" e "Versão 2".
            2. ALVO DE DENSIDADE: Estabilize o conteúdo em aproximadamente 2500 PALAVRAS. Não exceda 3000 para evitar dispersão.
            3. VARREDURA OBRIGATÓRIA: Você deve passar por cada diretriz do código do PanoramaView (linhas 566-642 do prompt) antes de gerar o conteúdo.
            4. MICROSCOPIA TOTAL: Fracione a explicação em porções de 2 a 3 versículos. Analise detalhes históricos, culturais e termos originais.
            5. CONVERSÕES TÉCNICAS: Converta moedas e medidas antigas para valores atuais (reais/métrica) em todos os casos.
            6. CONTEXTO DE ÉPOCA: Use referências reais de documentos do Oriente Próximo, Midrash e Talmud para enriquecer o cenário histórico.
            7. BLINDAGEM DOUTRINÁRIA: Samuel não apareceu em 1 Sm 28. O abismo de Lucas 16:26 é instransponível.
            8. ESTILO VISUAL: Use listas, negritos e parágrafos bem espaçados conforme o padrão acadêmico ADMA.
        `;
    } else if (taskType === 'commentary') {
        systemInstruction += " TAREFA: Comentário exegético profundo em 3 parágrafos com referências cruzadas detalhadas.";
    }

    // SELEÇÃO DE MODELO: 'gemini-flash-lite-latest' (Referente à versão 2.5 Lite Gratuita)
    const modelName = 'gemini-flash-lite-latest';

    let lastError;
    // Tenta executar o pedido percorrendo o pool de chaves em caso de falha de cota
    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            
            const generationConfig = {
                systemInstruction,
                responseMimeType: schema ? "application/json" : "text/plain",
                responseSchema: schema || undefined,
                temperature: 0.7, // Reduzido ligeiramente para maior foco e evitar repetições/versões múltiplas
                topP: 0.9,
            };

            // Configuração para sustentar a Densidade de 2500 palavras
            if (taskType === 'ebd' || isLongOutput) {
                generationConfig.maxOutputTokens = 6000; // Suficiente para 2500-3000 palavras sem truncar ou exagerar
                generationConfig.thinkingConfig = { thinkingBudget: 0 }; 
            }

            const responseContent = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: generationConfig
            });

            if (responseContent.text) {
                return response.status(200).json({ text: responseContent.text });
            }
        } catch (err) {
            lastError = err;
            console.error(`Falha no Executor com a chave: ${key.substring(0, 8)}... - Erro:`, err.message);
            if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('503')) continue;
            if (err.message.includes('API key not valid')) continue;
            break;
        }
    }
    
    return response.status(500).json({ error: lastError?.message || 'Falha na geração Magnum Opus após esgotar o pool de chaves.' });
  } catch (error) {
    console.error("Erro Crítico no Servidor de IA:", error);
    return response.status(500).json({ error: 'Erro crítico interno no executor ADMA.' });
  }
}
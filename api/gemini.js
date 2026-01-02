import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, // Timeout estendido para 5 minutos para processar a densidade Magnum Opus
};

/**
 * EXECUTOR MAGISTRAL ADMA v81.0 - RIGOR CANÔNICO & RESILIÊNCIA
 * Este arquivo é o motor que aciona a IA Gemini 2.5 (Versão Gratuita/Lite).
 * OBJETIVO: Garantir 2500 palavras exatas, exegese microscópica e obediência total ao limite real de versículos.
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
            PROTOCOLO MAGNUM OPUS v81.0 (VERSÃO ÚNICA E RIGOR CANÔNICO):
            1. ENTREGA ÚNICA: Gere apenas UMA versão do estudo. Proibido criar "Versão 1" e "Versão 2".
            2. ALVO DE DENSIDADE: Alvo de 2500 PALAVRAS. Se o capítulo for curto, aprofunde a análise dos versos existentes.
            3. ZERO ALUCINAÇÃO DE VERSÍCULOS: Você deve respeitar estritamente o limite canônico de versículos (ex: Josué 20 termina no verso 9). É PROIBIDO inventar versos 10, 11 ou subdividir versos para criar números falsos.
            4. VARREDURA OBRIGATÓRIA: Você deve passar por cada diretriz do código do PanoramaView (linhas 566-642 do prompt) antes de gerar o conteúdo.
            5. MICROSCOPIA TOTAL: Fracione a explicação em porções de 2 a 3 versículos. Analise detalhes históricos, culturais e termos originais.
            6. CONVERSÕES TÉCNICAS: Converta moedas e medidas antigas para valores atuais em todos os casos.
            7. CONTEXTO DE ÉPOCA: Use referências reais de documentos do Oriente Próximo, Midrash e Talmud para enriquecer o cenário histórico.
            8. BLINDAGEM DOUTRINÁRIA: Samuel não apareceu em 1 Sm 28. O abismo de Lucas 16:26 é instransponível.
            9. ESTILO VISUAL: Use listas, negritos e parágrafos bem espaçados conforme o padrão acadêmico ADMA.
        `;
    } else if (taskType === 'commentary') {
        systemInstruction += " TAREFA: Comentário exegético profundo em 3 parágrafos com referências cruzadas detalhadas.";
    }

    const modelName = 'gemini-flash-lite-latest';

    let lastError;
    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            
            const generationConfig = {
                systemInstruction,
                responseMimeType: schema ? "application/json" : "text/plain",
                responseSchema: schema || undefined,
                temperature: 0.7, 
                topP: 0.9,
            };

            if (taskType === 'ebd' || isLongOutput) {
                generationConfig.maxOutputTokens = 6000; 
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
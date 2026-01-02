import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, // Timeout estendido para 5 minutos para processar a densidade Magnum Opus
};

/**
 * EXECUTOR MAGISTRAL ADMA v82.5 - FIDELIDADE TOTAL & CALIBRAGEM DE VOLUME
 * Este arquivo é o motor que aciona a IA Gemini 2.5 (Versão Gratuita/Lite).
 * FOCO: Meta de 2500-2700 palavras e aplicação CONDICIONAL de protocolos de segurança.
 */
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') response.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKeys = [process.env.API_KEY, process.env.Biblia_ADMA_API]
        .filter(k => k && k.trim().length > 10)
        .map(k => k.trim());

    for (let i = 1; i <= 50; i++) {
        const val = process.env[`API_KEY_${i}`];
        if (val && val.trim().length > 10) apiKeys.push(val.trim());
    }
    
    if (apiKeys.length === 0) return response.status(500).json({ error: 'Erro de Configuração: Nenhuma chave API válida encontrada.' });

    const { prompt, schema, taskType, isLongOutput } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório.' });

    // --- SYSTEM INSTRUCTION: A MENTE DO PROF. MICHEL FELIX v82.5 ---
    let systemInstruction = "ATUE COMO: Professor Michel Felix. Identidade Teológica: Pentecostal Clássico, Erudito, Assembleiano e Arminiano. Sua identidade deve ser IMPLÍCITA.";
    
    if (taskType === 'ebd' || isLongOutput) {
        systemInstruction += `
            PROTOCOLO MAGNUM OPUS v82.5 (AUDITORIA EXEGÉTICA E CALIBRAGEM):
            
            1. REGRAS DE OURO DE FORMATAÇÃO:
               - PROIBIDO o uso de LaTeX ou notação matemática como $\\text{...}$. Escreva os caracteres originais (Hebraico/Grego) diretamente no texto simples.
               - LINGUAGEM: Use 100% Português. Substitua termos como "WITH" por "COM".
               - NUMERAÇÃO: Título sem número. INTRODUÇÃO item "1." e TÓPICOS item "2.".
            
            2. PROTOCOLO DE CONTEÚDO (CALIBRAGEM v82.5):
               - DENSIDADE CONTROLADA: Seu alvo é produzir entre 2500 a 2700 PALAVRAS por estudo. Não ultrapasse 2800.
               - RIGOR CANÔNICO: Respeite estritAMENTE a quantidade de versículos. Não invente versos.
               - EXEGESE MICROSCÓPICA: Fracione de 2 em 2 ou 3 em 3 versículos.
            
            3. BLINDAGEM DOUTRINÁRIA CONDICIONAL:
               - Protocolo 1 Sm 28 (Saul/Samuel/Necromancia): Aplique a refutação de que Samuel NÃO apareceu APENAS se o texto bíblico em análise tratar especificamente de necromancia ou consulta aos mortos.
               - Protocolo Lucas 16:26 (O Grande Abismo): Aplique a separação entre mortos e vivos como barreira intransponível APENAS se for pertinente ao contexto do capítulo.
               - Fora dessas condições, foque 100% na exegese gramatical-histórica do texto.
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
                temperature: 0.8,
                topP: 0.95,
            };

            if (taskType === 'ebd' || isLongOutput) {
                generationConfig.maxOutputTokens = 8192;
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
            break;
        }
    }
    
    return response.status(500).json({ error: lastError?.message || 'Falha na geração Magnum Opus.' });
  } catch (error) {
    console.error("Erro Crítico no Servidor de IA:", error);
    return response.status(500).json({ error: 'Erro crítico interno.' });
  }
}
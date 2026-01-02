import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, // Timeout estendido para 5 minutos para processar a densidade Magnum Opus
};

/**
 * EXECUTOR MAGISTRAL ADMA v82.0 - RIGOR CANÔNICO & AUDITORIA
 * Este arquivo é o motor que aciona a IA Gemini 2.5 (Versão Gratuita/Lite).
 * FOCO: Fidelidade 100% às diretrizes de Michel Felix.
 */
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

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

    // --- SYSTEM INSTRUCTION: A MENTE DO PROF. MICHEL FELIX v82 ---
    let systemInstruction = "ATUE COMO: Professor Michel Felix. Identidade Teológica: Pentecostal Clássico, Erudito, Assembleiano e Arminiano. Sua identidade deve ser IMPLÍCITA.";
    
    if (taskType === 'ebd' || isLongOutput) {
        systemInstruction += `
            PROTOCOLO MAGNUM OPUS v82.0 (AUDITORIA EXEGÉTICA E RIGOR CANÔNICO):
            
            1. REGRAS DE OURO DE FORMATAÇÃO:
               - PROIBIDO o uso de LaTeX ou notação matemática como $\\text{...}$. Escreva os caracteres originais (Hebraico/Grego) diretamente no texto simples.
               - LINGUAGEM: Use 100% Português. Corrija termos como "WITH" para "COM".
               - NUMERAÇÃO: O Título não recebe número. A INTRODUÇÃO deve ser o item "1." e os TÓPICOS DO ESTUDO o item "2.".
            
            2. PROTOCOLO DE CONTEÚDO (AUDITORIA EM 13 CHECK-INS):
               - Antes de gerar, você deve realizar mentalmente os 13 check-ins de auditoria (Limites, Palavras, Originais, Blindagem, Arqueologia, Tipologia, etc).
               - RIGOR CANÔNICO: Respeite estritamente o limite real de versículos. Não invente versículos inexistentes.
               - DENSIDADE: Alvo fixo de 2500 PALAVRAS. Use microscopia bíblica versículo por versículo.
            
            3. BLINDAGEM DOUTRINÁRIA:
               - Samuel não apareceu em 1 Sm 28. O abismo de Lucas 16:26 é instransponível.
               - Ortodoxia Pentecostal Clássica Assembleiana.
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
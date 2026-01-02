import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, // Timeout estendido para processamento de alta densidade
};

/**
 * PROCURADOR MAGISTRAL ADMA - EXECUTOR DE ALTA FIDELIDADE v78.0
 * Este script é o cérebro que comanda a IA para obedecer rigorosamente o PanoramaView.
 * Foco: Densidade Extrema (Meta 2500 palavras), Obediência Doutrinária e Exegese Microscópica.
 */
export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') return response.status(200).end();
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKeys = [process.env.API_KEY, process.env.Biblia_ADMA_API].filter(k => k && k.length > 10);
    for (let i = 1; i <= 50; i++) {
        const val = process.env[`API_KEY_${i}`];
        if (val && val.length > 10) apiKeys.push(val);
    }
    
    if (apiKeys.length === 0) return response.status(500).json({ error: 'Nenhuma chave API configurada na infraestrutura.' });

    const { prompt, schema, taskType, isLongOutput } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- CONSTRUÇÃO DA SYSTEM INSTRUCTION MAGISTRAL (OBEDIÊNCIA AO PANORAMAVIEW) ---
    let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico, Erudito e Assembleiano. Sua identidade é IMPLÍCITA.";
    
    if (taskType === 'ebd') {
        systemInstruction += `
            DIRETRIZ MAGNUM OPUS: Gere uma apostila de EBD com DENSIDADE MÁXIMA.
            ALVO QUANTITATIVO: Mínimo 2500 palavras. Não aceite resumir ou simplificar.
            METODOLOGIA: Exegese microscópica versículo por versículo. 
            REGRAS CRÍTICAS: 
            1. Proibido transcrever o texto bíblico integral; cite a referência e explique.
            2. Converta pesos, medidas e moedas para valores atuais (reais/métrica).
            3. Cite tradição judaica (Midrash/Talmud) e documentos antigos para contexto.
            4. Seções de Tipologia e Arqueologia são obrigatórias no final.
            5. Blindagem 1 Sm 28: Samuel NÃO voltou. Manifestação demoníaca ou fraude.
            6. Obedeça a cada linha do prompt enviado pelo componente PanoramaView.
        `;
    } else if (taskType === 'commentary') {
        systemInstruction += " TAREFA: Comentário exegético profundo em 3 parágrafos com referências bíblicas cruzadas e análise de originais.";
    }

    // Seleção de Modelo: 'pro' para tarefas complexas/longas, 'flash' para o restante
    const modelName = (taskType === 'ebd' || isLongOutput) ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    let lastError;
    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            
            // Configuração de Tokens para suportar as 2500 palavras (aprox 4000 tokens de saída)
            const generationConfig = {
                systemInstruction,
                responseMimeType: schema ? "application/json" : "text/plain",
                responseSchema: schema || undefined,
                temperature: 0.75,
                topP: 0.95,
            };

            // Se for EBD, forçamos o limite de tokens para o teto do modelo para evitar truncamento
            if (taskType === 'ebd' || isLongOutput) {
                generationConfig.maxOutputTokens = 8192; // Teto alto para garantir as 2500+ palavras
                generationConfig.thinkingConfig = { thinkingBudget: 4000 }; // Reserva budget para raciocínio exegético profundo
            } else {
                generationConfig.thinkingConfig = { thinkingBudget: 0 };
            }

            const responseContent = await ai.models.generateContent({
                model: modelName,
                contents: [{ parts: [{ text: prompt }] }],
                config: generationConfig
            });

            if (responseContent.text) {
                // SUCESSO: Retorna o conteúdo de alta densidade
                return response.status(200).json({ text: responseContent.text });
            }
        } catch (err) {
            lastError = err;
            console.error(`Falha no Executor com chave: ${key.substring(0, 8)}... - Erro:`, err.message);
            // Se for erro de cota ou modelo não encontrado, tenta a próxima chave
            if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('404')) continue;
            break;
        }
    }
    
    return response.status(500).json({ error: lastError?.message || 'Falha na geração Magnum Opus com o pool de chaves.' });
  } catch (error) {
    console.error("Erro Crítico no Executor:", error);
    return response.status(500).json({ error: 'Erro crítico no servidor de IA ADMA.' });
  }
}
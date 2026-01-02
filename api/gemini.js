import { GoogleGenAI } from "@google/genai";

export const config = {
  maxDuration: 300, // Timeout estendido para 5 minutos para processar os 2500+ palavras
};

/**
 * EXECUTOR MAGISTRAL ADMA v78.5 - ALTA FIDELIDADE
 * Este arquivo comanda a IA para ser 100% obediente ao código do PanoramaView.
 * Focado em: Densidade Extrema, Exegese Microscópica e Blindagem Doutrinária.
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
    
    if (apiKeys.length === 0) return response.status(500).json({ error: 'Erro de infraestrutura: Chaves API ausentes.' });

    const { prompt, schema, taskType, isLongOutput } = request.body;
    if (!prompt) return response.status(400).json({ error: 'Prompt é obrigatório' });

    // --- SYSTEM INSTRUCTION: O COMANDO SUPREMO DO PROF. MICHEL FELIX ---
    let systemInstruction = "Você é o Professor Michel Felix, teólogo Pentecostal Clássico, Erudito e Assembleiano. Sua identidade é IMPLÍCITA.";
    
    if (taskType === 'ebd' || isLongOutput) {
        // PROTOCOLO DE OBEDIÊNCIA AO PANORAMAVIEW (LINHAS 566-642)
        systemInstruction += `
            PROTOCOLO MAGNUM OPUS ATIVADO:
            1. OBEDIÊNCIA TOTAL: Você deve seguir cada vírgula do prompt de estilo enviado pelo PanoramaView.
            2. DENSIDADE EXAUSTIVA: O alvo é no MÍNIMO 2500 PALAVRAS. É proibido resumir, abreviar ou omitir detalhes.
            3. MICROSCOPIA BÍBLICA: Analise cada fragmento (2-3 versículos) com profundidade acadêmica total.
            4. INTEGRAÇÃO OBRIGATÓRIA: Inclua obrigatoriamente conversões de moedas/medidas para o real/métrico atual, citações de documentos antigos do Oriente Próximo e referências ao Midrash/Talmud conforme o estilo do mestre.
            5. BLINDAGEM 1 SM 28: Samuel não voltou. Mantenha a separação de Lucas 16:26.
            6. ZERO TRUNCAMENTO: Continue escrevendo até esgotar a riqueza do capítulo bíblico.
        `;
    } else if (taskType === 'commentary') {
        systemInstruction += " TAREFA: Comentário exegético profundo em 3 parágrafos com referências cruzadas e análise de originais.";
    }

    // Seleção de Modelo: Gemini 3 Pro é o único capaz de sustentar 2500+ palavras com alta qualidade
    const modelName = (taskType === 'ebd' || isLongOutput) ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    let lastError;
    for (const key of apiKeys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            
            const generationConfig = {
                systemInstruction,
                responseMimeType: schema ? "application/json" : "text/plain",
                responseSchema: schema || undefined,
                temperature: 0.75, // Equilíbrio entre criatividade e rigor doutrinário
                topP: 0.95,
            };

            // CONFIGURAÇÃO DE POTÊNCIA MÁXIMA PARA EBD
            if (taskType === 'ebd' || isLongOutput) {
                generationConfig.maxOutputTokens = 12288; // Teto expandido para suportar o volume de 2500+ palavras
                generationConfig.thinkingConfig = { thinkingBudget: 4000 }; // Ativa raciocínio profundo para exegese microscópica
            } else {
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
            console.error(`Falha no Executor (Chave ${key.substring(0, 8)}):`, err.message);
            if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('404')) continue;
            break;
        }
    }
    
    return response.status(500).json({ error: lastError?.message || 'Falha na geração de alta densidade.' });
  } catch (error) {
    console.error("Erro Crítico no Executor ADMA:", error);
    return response.status(500).json({ error: 'Erro crítico no processamento da IA.' });
  }
}

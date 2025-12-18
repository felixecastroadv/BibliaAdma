import { GoogleGenAI } from "@google/genai";

export const generateContent = async (prompt: string, jsonSchema?: any) => {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      // Use process.env.API_KEY exclusively as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      const config: any = {
        temperature: 0.4,
        topP: 0.95,
        topK: 40, 
      };

      if (jsonSchema) {
        config.responseMimeType = "application/json";
        config.responseSchema = jsonSchema;
      }

      // Using gemini-3-flash-preview for efficiency and quality as per instructions
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: config
      });
      
      // Correctly access .text property (not a method)
      const text = response.text; 
      
      if (jsonSchema && text) {
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error("JSON Parse Error:", text);
          throw new Error("A IA retornou um formato de dados inválido. Tente novamente.");
        }
      }
      
      return text;

    } catch (error: any) {
      attempt++;
      const isQuotaError = error.message?.includes("429") || error.message?.includes("QUOTA");
      if (attempt >= MAX_RETRIES || !isQuotaError) throw error;
      // Exponential backoff for quota errors
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
};
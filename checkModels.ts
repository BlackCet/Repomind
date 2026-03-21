import { GoogleGenAI } from "@google/genai";

// Apni actual API key use karna ya .env configure rakhna
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "YOUR_API_KEY" });

export const listAvailableModels = async () => {
  console.log("Fetching available models...");
  try {
    const response = await ai.models.list();
    
    for await (const model of response) {
      console.log(`Model Name: ${model.name}`);
      // Agar description ya aur details chahiye toh:
      // console.log(`Display Name: ${model.displayName}, Description: ${model.description}\n`);
    }
  } catch (error) {
    console.error("Models fetch karne mein error aayi:", error);
  }
};

// Function call
listAvailableModels();
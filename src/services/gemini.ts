import { GoogleGenAI, Type } from "@google/genai";


const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

export const analyzeCodebase = async (fileTree: string, files: { path: string; content: string }[]) => {
  const model = "gemini-2.5-flash";
  
  const response = await ai.models.generateContent({
    model,
    contents: `
      Analyze the following GitHub repository.
      
      FILE TREE:
      ${fileTree}
      IMPORTANT FILE CONTENTS:
      ${files.map(f => {
        // Ensure content is a string and handle null/undefined
        const safeContent = typeof f.content === 'string' 
            ? f.content 
            : JSON.stringify(f.content || "");
            
        return `--- FILE: ${f.path} ---\n${safeContent.slice(0, 4000)}`;
      }).join('\n\n')}
      
      Provide a structured analysis in JSON format.
      IGNORE README files for logic analysis.
      
      Required JSON structure:
      {
        "name": "Project Name",
        "purpose": "Core Purpose",
        "techStack": ["Tech 1", "Tech 2"],
        "architecture": "Architecture Pattern",
        "modules": [{"name": "Module", "responsibility": "Desc"}],
        "entryPoints": ["path/to/entry"],
        "deployment": {
          "env": "node|python|go|static|etc",
          "buildCommand": "command to build",
          "startCommand": "command to start",
          "envVars": [{"key": "PORT", "value": "3000"}]
        },
        "oauth": {
          "required": true|false,
          "envVars": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
          "gcloudScript": "#!/bin/bash\n\n# 1. Prompt for Project ID\nread -p \"Enter your desired Google Cloud Project ID: \" PROJECT_ID\n\n# 2. Create the project\ngcloud projects create $PROJECT_ID --name=\"RepoMind AI Project\"\n\n# 3. Set the project as default\ngcloud config set project $PROJECT_ID\n\n# 4. Enable necessary APIs\ngcloud services enable compute.googleapis.com \\\n                       container.googleapis.com \\\n                       iap.googleapis.com \\\n                       identitytoolkit.googleapis.com\n\n# 5. Create OAuth Consent Screen (Manual step required, providing URL)\necho \"------------------------------------------------------------\"\necho \"MANUAL STEP: Configure OAuth Consent Screen at:\"\necho \"https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID\"\necho \"------------------------------------------------------------\"\n\n# 6. Create OAuth Credentials\necho \"After configuring the consent screen, create OAuth credentials at:\"\necho \"https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID\"\necho \"Select 'Web application' and add your App URL to Authorized Redirect URIs.\"\n"
        }
      }
      
      For the gcloudScript, provide a complete bash script that:
      1. Prompts for a project ID.
      2. Creates the project: gcloud projects create $PROJECT_ID
      3. Enables services: gcloud services enable compute.googleapis.com container.googleapis.com
      4. Sets up the OAuth consent screen (if possible via CLI) or provides the direct URL to do it.
      5. Explains how to create the client ID and secret.
    `,
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text);
};

export const suggestChanges = async (context: string, prompt: string) => {
  const model = "gemini-2.5-flash";
  
  const response = await ai.models.generateContent({
    model,
    contents: `
      Based on the following codebase analysis, suggest code changes or feature integrations for the user's request.
      
      CODEBASE CONTEXT:
      ${context}
      
      USER REQUEST:
      ${prompt}
      
      Provide a detailed response with code snippets in markdown.
    `,
  });

  return response.text;
};

export const generateUML = async (context: string) => {
  const model = "gemini-2.5-flash"; 
  
  const prompt = `
    Based on this codebase context, generate 3 Mermaid.js diagrams:
    1. A Class Diagram of core entities.
    2. A Sequence Diagram of the main user flow.
    3. A State Diagram of the application lifecycle.
    
    CRITICAL RULES FOR MERMAID SYNTAX:
    - Use strict, valid Mermaid syntax.
    - Node IDs must be alphanumeric without spaces (e.g., NodeA).
    - Node labels MUST be wrapped in double quotes (e.g., NodeA["My Label"]).
    - Do not use reserved characters like (, ), [, ] inside unquoted labels.
    
    Return them as a single string with markdown headers.
    
    Context:
    ${context}
  `;


  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};

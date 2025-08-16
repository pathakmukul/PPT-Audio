
import { GoogleGenAI, Type } from "@google/genai";
import type { Presentation, UploadedImage } from '../types';

if (!import.meta.env.VITE_API_KEY) {
    throw new Error("VITE_API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<string> => {
  try {
    const audioPart = {
      inlineData: {
        data: audioBase64.split(",")[1],
        mimeType,
      },
    };
    const textPart = { text: "Transcribe this audio recording accurately. Provide only the transcribed text." };
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [audioPart, textPart] },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error transcribing audio with Gemini:", error);
    throw new Error("Failed to transcribe audio. Please check the console for details.");
  }
};

const presentationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'A concise and engaging title for the slide.',
      },
      content: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: 'An array of key bullet points for the slide content. Each string is a separate bullet point.',
      },
      speakerNotes: {
        type: Type.STRING,
        description: 'Detailed speaker notes that elaborate on the bullet points, providing context and deeper explanation.',
      },
      imagePlaceholder: {
        type: Type.STRING,
        description: 'If this slide should include one of the user-provided images, specify its placeholder here (e.g., "IMAGE_1", "IMAGE_2"). Otherwise, omit this field.'
      },
    },
    required: ["title", "content", "speakerNotes"],
  },
};

const fileToGenerativePart = (base64: string, mimeType: string) => {
    return {
        inlineData: {
            data: base64.split(",")[1],
            mimeType,
        },
    };
};

export const generatePresentationFromText = async (text: string, images: UploadedImage[]): Promise<Presentation> => {
  const systemInstruction = `You are an expert presentation creator. Your task is to take the user's raw text transcript and structure it into a professional and coherent presentation. The presentation should have a logical flow. For each slide, create a concise title, a list of key bullet points (as an array of strings), and detailed speaker notes. The first slide should be a title slide with a captivating title for the overall presentation. If the user provides images, incorporate them into relevant slides. Use the provided image descriptions to guide their placement. When you use an image on a slide, set the 'imagePlaceholder' property in the JSON to the corresponding image identifier (e.g., 'IMAGE_1').`;
  
  let textPrompt = `Here is the transcript:\n\n${text}`;
  
  if (images.length > 0) {
    textPrompt += `\n\n---\n\nHere are the user-provided images to include in the presentation. Use their descriptions to place them on the most relevant slides:`;
    images.forEach((image, index) => {
      textPrompt += `\nIMAGE_${index + 1}: ${image.description || 'An image provided by the user.'}`;
    });
  }

  const parts = [
    { text: textPrompt },
    ...images.map(image => fileToGenerativePart(image.base64, image.file.type))
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: presentationSchema,
        temperature: 0.7,
      },
    });

    const jsonString = response.text.trim();
    const presentationData = JSON.parse(jsonString);

    if (Array.isArray(presentationData) && presentationData.every(slide => 
        'title' in slide && 'content' in slide && 'speakerNotes' in slide && Array.isArray(slide.content)
    )) {
      return presentationData as Presentation;
    } else {
      throw new Error("AI response did not match the expected presentation format.");
    }
  } catch (error) {
    console.error("Error generating presentation from Gemini:", error);
    throw new Error("Failed to generate presentation. Please check the console for details.");
  }
};

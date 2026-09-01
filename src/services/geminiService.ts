import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AnalysisResult {
  vehicleNumber: string;
  violationType: 'NONE' | 'OVER_SPEEDING' | 'TRIPLE_RIDING' | 'FAKE_PLATE' | 'ACCIDENT' | 'MANUAL_REPORT';
  confidence: number;
  description: string;
}

export async function analyzeHelmetFeed(imageBase64: string): Promise<AnalysisResult> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: "image/jpeg",
            },
          },
          {
            text: `Analyze this image from a motorcycle smart helmet. 
            Identify:
            1. The vehicle number plate (if visible).
            2. Any traffic violations present:
               - Triple riding (more than 2 people on a bike)
               - Overspeeding (if context suggests high speed)
               - Fake number plate (if looking suspicious/non-standard)
               - Accident occurrence
            
            Return the result in JSON format with fields: vehicleNumber, violationType, confidence (0-1), description.
            violationType should be one of: NONE, OVER_SPEEDING, TRIPLE_RIDING, FAKE_PLATE, ACCIDENT, MANUAL_REPORT.`,
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vehicleNumber: { type: Type.STRING },
            violationType: { 
              type: Type.STRING,
              enum: ["NONE", "OVER_SPEEDING", "TRIPLE_RIDING", "FAKE_PLATE", "ACCIDENT", "MANUAL_REPORT"]
            },
            confidence: { type: Type.NUMBER },
            description: { type: Type.STRING }
          }
        }
      }
    });

    return JSON.parse(response.text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return {
      vehicleNumber: "Unknown",
      violationType: 'NONE',
      confidence: 0,
      description: "Analysis failed"
    };
  }
}

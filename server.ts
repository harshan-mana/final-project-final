import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Lazy initializer for Gemini client to prevent crashing if key is missing
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "online",
    system: "AegisHelmet AI Core",
    timestamp: new Date().toISOString(),
  });
});

// Helmet video feed analysis endpoint
app.post("/api/analyze-helmet", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 payload" });
    }

    const ai = getAI();
    const prompt = `You are the edge AI vision engine of an Aegis Smart Motorcycle Helmet.
Analyze the provided visual frame from the rider's perspective or front/rear camera.

Your tasks:
1. Extract any visible vehicle license/registration number plate in standard format (e.g. "KA-01-HH-1234", "DL-03-CC-9988", "MH-12-AB-5678"). If no clear plate is readable, return "Unknown" or infer most probable characters.
2. Detect safety violations or critical road events:
   - "TRIPLE_RIDING": More than 2 people on a two-wheeler / motorcycle / scooter.
   - "ACCIDENT": Motorcycle crashed, fallen rider, vehicle collision, impact on road, debris.
   - "OVER_SPEEDING": Contextual cues indicating dangerous high-velocity riding, blurred motion near obstacles, or dangerous overtaking.
   - "NO_HELMET": Rider or pillion without a helmet.
   - "FAKE_PLATE": Hand-written, broken, altered, taped, or non-standard license plate.
   - "NONE": Safe normal driving, no traffic violations.
3. Calculate confidence score between 0.0 and 1.0.
4. Provide a concise, professional technical description of the detection.
5. Provide a recommended fine / penalty in INR (e.g., 1000 for Triple Riding, 2000 for Overspeeding, 5000 for Fake Plate, 10000 for Severe Accident/Dangerous Driving, 0 for None).

Return JSON strictly adhering to schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: "image/jpeg",
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vehicleNumber: { type: Type.STRING },
            violationType: {
              type: Type.STRING,
              enum: [
                "NONE",
                "TRIPLE_RIDING",
                "ACCIDENT",
                "OVER_SPEEDING",
                "NO_HELMET",
                "FAKE_PLATE",
                "MANUAL_REPORT",
              ],
            },
            confidence: { type: Type.NUMBER },
            description: { type: Type.STRING },
            penaltyAmount: { type: Type.NUMBER },
            estimatedSpeedKmH: { type: Type.NUMBER },
          },
          required: ["vehicleNumber", "violationType", "confidence", "description"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      vehicleNumber: parsed.vehicleNumber || "Unknown",
      violationType: parsed.violationType || "NONE",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.85,
      description: parsed.description || "Analysis processed successfully.",
      penaltyAmount: parsed.penaltyAmount || 0,
      estimatedSpeedKmH: parsed.estimatedSpeedKmH || 48,
    });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return res.status(500).json({
      error: error?.message || "Inference error",
      vehicleNumber: "Unknown",
      violationType: "NONE",
      confidence: 0,
      description: "Visual analysis encounter: " + (error?.message || "service error"),
    });
  }
});

// Vite & Static file serving setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Aegis Server active at http://0.0.0.0:${PORT}`);
  });
}

start();

export interface AnalysisResult {
  vehicleNumber: string;
  violationType: 'NONE' | 'OVER_SPEEDING' | 'TRIPLE_RIDING' | 'FAKE_PLATE' | 'ACCIDENT' | 'NO_HELMET' | 'MANUAL_REPORT';
  confidence: number;
  description: string;
  penaltyAmount?: number;
  estimatedSpeedKmH?: number;
}

export async function analyzeHelmetFeed(imageBase64: string): Promise<AnalysisResult> {
  try {
    const response = await fetch('/api/analyze-helmet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64 }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      vehicleNumber: data.vehicleNumber || 'Unknown',
      violationType: data.violationType || 'NONE',
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.85,
      description: data.description || 'Vision analysis completed.',
      penaltyAmount: data.penaltyAmount || 0,
      estimatedSpeedKmH: data.estimatedSpeedKmH || 45,
    };
  } catch (error: any) {
    console.error('Gemini vision analysis failed:', error);
    return {
      vehicleNumber: 'Unknown',
      violationType: 'NONE',
      confidence: 0,
      description: 'Network or AI engine error: ' + (error?.message || 'Check connection'),
      penaltyAmount: 0,
    };
  }
}

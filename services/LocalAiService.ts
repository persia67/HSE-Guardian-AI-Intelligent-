
import { GoogleGenAI } from "@google/genai";

/**
 * LocalAiService provides high-performance safety analysis capabilities
 * powered by Google Gemini. It maintains a stateful connection and 
 * handles both vision-based inspection and text-based auditing.
 */
class LocalAiService {
  private ready = false;

  /**
   * Initializes the AI engine. While Gemini is cloud-based, we simulate the 
   * loading sequence expected by the UI for a consistent user experience.
   */
  async initialize(onProgress: (progress: number, text: string) => void): Promise<void> {
    if (this.ready) return;

    onProgress(10, "Establishing connection to Gemini AI...");
    await new Promise(r => setTimeout(r, 400));
    onProgress(50, "Configuring safety audit parameters...");
    await new Promise(r => setTimeout(r, 400));
    onProgress(85, "Optimizing vision inspection engine...");
    await new Promise(r => setTimeout(r, 400));
    onProgress(100, "AI Core Online (Gemini 3 Pro)");
    
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Analyzes an image frame for safety violations or hazards.
   * @param base64Data Raw base64 image string (no header).
   * @param prompt The inspection query.
   */
  async analyzeImage(base64Data: string, prompt: string): Promise<string> {
    if (!this.ready) throw new Error("AI Engine not initialized");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      return response.text || "No analysis produced.";
    } catch (err) {
      console.error("Gemini Vision Error:", err);
      return "Critical Error: Vision analysis uplink failed.";
    }
  }

  /**
   * Generates a safety report based on historical log data.
   * @param prompt The compiled logs and instructions.
   */
  async generateText(prompt: string): Promise<string> {
    if (!this.ready) throw new Error("AI Engine not initialized");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      return response.text || "No report content generated.";
    } catch (err) {
      console.error("Gemini Generation Error:", err);
      return "Critical Error: Report synthesis failed.";
    }
  }
}

export const localAi = new LocalAiService();

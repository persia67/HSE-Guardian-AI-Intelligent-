
import { CreateMLCEngine, MLCEngine, InitProgressCallback } from "@mlc-ai/web-llm";

// Using Phi-3.5 Vision as it is efficient for edge devices
const SELECTED_MODEL = "Phi-3.5-vision-instruct-q4f16_1-MLC";

class LocalAiService {
  private engine: MLCEngine | null = null;
  private isInitializing = false;

  async initialize(onProgress: (progress: number, text: string) => void): Promise<void> {
    if (this.engine || this.isInitializing) return;

    this.isInitializing = true;
    
    const initProgressCallback: InitProgressCallback = (report) => {
      // report.progress is 0-1
      onProgress(report.progress * 100, report.text);
    };

    try {
      this.engine = await CreateMLCEngine(
        SELECTED_MODEL,
        { initProgressCallback }
      );
      console.log("Local AI Engine Loaded");
    } catch (error) {
      console.error("Failed to load Local AI:", error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  isReady(): boolean {
    return this.engine !== null;
  }

  async analyzeImage(imageUrl: string, prompt: string): Promise<string> {
    if (!this.engine) throw new Error("AI Engine not initialized");

    const messages = [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageUrl}` } },
          { type: "text", text: prompt }
        ]
      }
    ];

    const reply = await this.engine.chat.completions.create({
      messages: messages as any,
      max_tokens: 256, // Limit tokens for speed
    });

    return reply.choices[0].message.content || "No analysis produced.";
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.engine) throw new Error("AI Engine not initialized");

    const messages = [
      { role: "user", content: prompt }
    ];

    const reply = await this.engine.chat.completions.create({
      messages: messages as any,
      max_tokens: 512,
    });

    return reply.choices[0].message.content || "No text generated.";
  }
}

export const localAi = new LocalAiService();

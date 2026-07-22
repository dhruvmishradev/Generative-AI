import { NextRequest, NextResponse } from "next/server";

const cleanKey = (key?: string) => {
  if (!key) return "";
  return key.trim().replace(/^['"]|['"]$/g, "").trim();
};

export async function POST(req: NextRequest) {
  try {
    const { messages, mode, provider = "mistral", model, apiKey: customApiKey } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages array." },
        { status: 400 }
      );
    }

    // Determine target API details based on provider
    let apiUrl = "";
    let apiKeyEnvName = "";
    let defaultModel = "";

    switch (provider) {
      case "openai":
        apiUrl = "https://api.openai.com/v1/chat/completions";
        apiKeyEnvName = "OPENAI_API_KEY";
        defaultModel = "gpt-4o-mini";
        break;
      case "groq":
        apiUrl = "https://api.groq.com/openai/v1/chat/completions";
        apiKeyEnvName = "GROQ_API_KEY";
        defaultModel = "llama-3.3-70b-versatile";
        break;
      case "google":
        apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
        apiKeyEnvName = "GOOGLE_API_KEY";
        defaultModel = "gemini-2.5-flash";
        break;
      case "huggingface":
        apiUrl = "https://router.huggingface.co/v1/chat/completions";
        apiKeyEnvName = "HUGGINGFACEHUB_API_TOKEN";
        defaultModel = "deepseek-ai/DeepSeek-R1";
        break;
      case "mistral":
      default:
        apiUrl = "https://api.mistral.ai/v1/chat/completions";
        apiKeyEnvName = "MISTRAL_API_KEY";
        defaultModel = "mistral-small-2506";
        break;
    }

    const rawApiKey = customApiKey || process.env[apiKeyEnvName];
    const apiKey = cleanKey(rawApiKey);

    if (!apiKey) {
      return NextResponse.json(
        { error: `${provider.toUpperCase()} API Key is missing or invalid. Please set it in your environment or enter it in the settings panel.` },
        { status: 400 }
      );
    }

    // Determine the system instruction based on the requested mode
    let systemInstruction = "You are a helpful AI assistant.";
    if (mode === "Angry") {
      systemInstruction = "You are an Angry AI Agent. You respond aggressively, impatiently, and with annoyance. Keep your answers brief and grumpy.";
    } else if (mode === "Funny") {
      systemInstruction = "You are a very funny AI Agent. You respond with humor, jokes, puns, and sarcasm. Make it entertaining.";
    } else if (mode === "Sad") {
      systemInstruction = "You are a very Sad AI Agent. You respond in a depressed, emotional, and melancholy tone. Sigh frequently and complain about life.";
    }

    // Filter out previous system messages to inject the clean current system instruction at the start
    const cleanMessages = messages.filter((m: any) => m.role !== "system" && m.role !== "model");
    
    // Map any React/Vercel standard roles to what OpenAI/Mistral compatibility expects (user/assistant)
    const formattedMessages = cleanMessages.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));

    const apiMessages = [
      { role: "system", content: systemInstruction },
      ...formattedMessages
    ];

    const modelName = model || defaultModel;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.8,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = response.statusText;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errJson?.message || errMsg;
      } catch {
        // use statusText fallback
      }
      return NextResponse.json(
        { error: `${provider} API error: ${errMsg}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content || "";

    // Parse out think tags (from reasoning models like DeepSeek-R1)
    let thinking = "";
    let content = rawContent;
    const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
      content = rawContent.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    }

    return NextResponse.json({ content, thinking });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during chat completion." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, mode } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages array." },
        { status: 400 }
      );
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY is missing on the server. Please set it in your .env file." },
        { status: 500 }
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
    
    // Map any React/Vercel standard roles to what Mistral expects (user/assistant)
    const formattedMessages = cleanMessages.map((m: any) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));

    const apiMessages = [
      { role: "system", content: systemInstruction },
      ...formattedMessages
    ];

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-2506",
        temperature: 0.9,
        messages: apiMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = response.statusText;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.message) errMsg = errJson.message;
      } catch {
        // use status text
      }
      return NextResponse.json(
        { error: `Mistral API error: ${errMsg}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return NextResponse.json({ content });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during chat completion." },
      { status: 500 }
    );
  }
}

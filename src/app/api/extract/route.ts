import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { paragraph } = await req.json();

    if (!paragraph || typeof paragraph !== "string" || !paragraph.trim()) {
      return NextResponse.json(
        { error: "Please enter a paragraph to extract information." },
        { status: 400 }
      );
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "MISTRAL_API_KEY is missing on the server. Please set it in your .env.local file." },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a Professional Information Extraction Assistant.

Your Task:
Extract the most useful and relevant information from the given paragraph and present it in a clean, well-structured format.

Rules:
- Read the entire paragraph carefully.
- Extract ONLY information explicitly mentioned.
- Do NOT hallucinate or assume missing information.
- If any information is unavailable, write "Not Mentioned".
- Keep summaries concise and factual.
- Preserve names, dates, numbers, and titles exactly as written.
- Do NOT add explanations or extra commentary.
- Organize the output with proper headings.
- Use bullet points where appropriate.`;

    const userPrompt = `Extract useful information from the following paragraph.

${paragraph}`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-2506",
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = response.statusText;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.message) errMsg = errJson.message;
      } catch {
        // use default error message
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
      { error: error?.message || "An unexpected error occurred during extraction." },
      { status: 500 }
    );
  }
}

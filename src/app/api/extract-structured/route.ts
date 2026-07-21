import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { paragraph, apiKey: customApiKey, model, temperature } = await req.json();

    if (!paragraph || typeof paragraph !== "string" || !paragraph.trim()) {
      return NextResponse.json(
        { error: "Please enter a paragraph to extract information." },
        { status: 400 }
      );
    }

    // Use custom API key from client state if provided, otherwise fallback to server env key
    const apiKey = customApiKey || process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Mistral API Key is missing. Please set it in your environment or enter it in the parameters sidebar." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a Professional Structured Information Extraction Assistant.

Your Task:
Extract the movie information from the provided text and output it as a JSON object matching this schema:
{
  "title": "The exact title of the movie (string)",
  "release_year": "The release year of the movie as an integer, or null if not mentioned",
  "genre": ["List of genres mentioned (array of strings)"],
  "director": "The director of the movie, or null if not mentioned (string)",
  "cast": ["List of actors/cast members mentioned (array of strings)"],
  "rating": "The movie rating, normalized out of 10 if necessary (e.g. 8.7), or null if not mentioned (number)",
  "summary": "A concise summary of the movie's plot/description in 2-3 sentences (string)"
}

Rules:
- Output ONLY a valid JSON object. Do NOT wrap it in markdown block tags (like \`\`\`json).
- Extract ONLY information explicitly mentioned. Do NOT hallucinate or assume missing information.
- If a field is not mentioned, use null (or empty array for cast/genre).
- Maintain exact dates, names, numbers, and titles.`;

    const userPrompt = `Extract structured movie info from the following paragraph:
"${paragraph}"`;

    const modelName = model || "mistral-small-2506";
    const tempValue = typeof temperature === "number" ? temperature : 0.1;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        temperature: tempValue,
        response_format: { type: "json_object" },
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
        // use status text
      }
      return NextResponse.json(
        { error: `Mistral API error: ${errMsg}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content || "{}";

    let parsedContent;
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (e) {
      return NextResponse.json(
        { error: "Mistral returned an invalid JSON response. Please try again.", rawContent },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedContent);
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during structured extraction." },
      { status: 500 }
    );
  }
}

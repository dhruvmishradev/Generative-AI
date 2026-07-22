import { NextRequest, NextResponse } from "next/server";

const cleanKey = (key?: string) => {
  if (!key) return "";
  return key.trim().replace(/^['"]|['"]$/g, "").trim();
};

function extractJson(text: string) {
  // Strip DeepSeek think blocks if present
  let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  
  // Strip markdown code block formatting if present (e.g. ```json ... ``` or ``` ...)
  cleanText = cleanText.replace(/^```json\s*/i, "");
  cleanText = cleanText.replace(/^```\s*/, "");
  cleanText = cleanText.replace(/```$/, "");
  cleanText = cleanText.trim();

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Attempt to locate the first '{' and last '}' to extract raw JSON
    const firstBrace = cleanText.indexOf("{");
    const lastBrace = cleanText.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleanText.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(jsonCandidate);
      } catch (err) {
        throw new Error("Failed to parse extracted JSON content from the model's response.");
      }
    }
    throw new Error("Model response did not contain a valid JSON object.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { paragraph, provider = "mistral", model, apiKey: customApiKey, temperature } = await req.json();

    if (!paragraph || typeof paragraph !== "string" || !paragraph.trim()) {
      return NextResponse.json(
        { error: "Please enter a paragraph to extract information." },
        { status: 400 }
      );
    }

    // Determine target API details based on the provider
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
- Output ONLY a valid JSON object. Do NOT wrap it in markdown block tags.
- Extract ONLY information explicitly mentioned. Do NOT hallucinate or assume missing information.
- If a field is not mentioned, use null (or empty array for cast/genre).
- Maintain exact dates, names, numbers, and titles.`;

    const userPrompt = `Extract structured movie info from the following paragraph:
"${paragraph}"`;

    const modelName = model || defaultModel;
    const tempValue = typeof temperature === "number" ? temperature : 0.1;

    // Body construction
    const requestBody: any = {
      model: modelName,
      temperature: tempValue,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    // Hugging Face inference router does not consistently support response_format: json_object across all models
    if (provider !== "huggingface") {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
    const rawContent = data?.choices?.[0]?.message?.content || "{}";

    try {
      const parsedContent = extractJson(rawContent);
      return NextResponse.json(parsedContent);
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message || "Invalid JSON returned by model.", rawContent },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "An unexpected error occurred during structured extraction." },
      { status: 500 }
    );
  }
}

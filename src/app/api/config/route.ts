import { NextResponse } from "next/server";

const cleanKey = (key?: string) => {
  if (!key) return "";
  return key.trim().replace(/^['"]|['"]$/g, "").trim();
};

export async function GET() {
  return NextResponse.json({
    mistral: !!cleanKey(process.env.MISTRAL_API_KEY),
    openai: !!cleanKey(process.env.OPENAI_API_KEY),
    groq: !!cleanKey(process.env.GROQ_API_KEY),
    google: !!cleanKey(process.env.GOOGLE_API_KEY),
    huggingface: !!cleanKey(process.env.HUGGINGFACEHUB_API_TOKEN),
  });
}

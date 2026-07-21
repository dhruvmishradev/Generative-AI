import { NextResponse } from "next/server";

export async function GET() {
  const isKeySet = !!process.env.MISTRAL_API_KEY;
  return NextResponse.json({ isKeySet });
}

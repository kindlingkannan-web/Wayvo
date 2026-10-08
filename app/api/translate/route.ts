import { NextResponse } from "next/server";
import { fetchLiveTranslation } from "@/lib/liveTravelService";
import { claude, parseJSON } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      try {
        const textBody = await req.text();
        body = JSON.parse(textBody);
      } catch {
        return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      }
    }

    const text = body?.text;
    const to = body?.to;
    const from = body?.from;

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Text to translate is required" }, { status: 400 });
    }

    const targetLang = to || "English";
    const sourceLang = from || "auto";

    // 1. Live Real-Time HTTP Translation Engine (zero latency, works for any phrase)
    try {
      const liveResult = await fetchLiveTranslation(text.trim(), targetLang, sourceLang);
      if (liveResult && liveResult.translation) {
        return NextResponse.json(liveResult);
      }
    } catch (liveErr: any) {
      console.warn("Live translation error, checking Claude fallback:", liveErr.message);
    }

    // 2. Claude AI fallback if API key configured
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const prompt = `Translate this text accurately into natural spoken ${targetLang}. Return ONLY valid JSON: {"detected": "source language name", "translation": "translated text"}`;
        const res = await claude(
          "You are a professional multilingual travel interpreter. Return ONLY pure JSON.",
          `Target language: ${targetLang}\nText: ${text}`,
          500
        );
        if (res) {
          const parsed = parseJSON(res);
          if (parsed && parsed.translation) {
            return NextResponse.json({
              detected: parsed.detected || "Detected language",
              translation: parsed.translation,
              source: "AI translation",
            });
          }
        }
      } catch (aiErr) {
        console.warn("Claude translation error:", aiErr);
      }
    }

    // 3. Fallback echo
    return NextResponse.json({
      detected: "Detected language",
      translation: text,
      source: "Fallback echo",
    });
  } catch (err: any) {
    console.error("Translation route error:", err);
    return NextResponse.json({ error: err.message || "Translation failed" }, { status: 500 });
  }
}

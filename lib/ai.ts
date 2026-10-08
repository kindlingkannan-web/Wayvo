export async function claude(
  system: string,
  user: string,
  maxTokens = 6000
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000); // 35s timeout

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn("Anthropic API returned status", res.status);
      return null;
    }

    const data = await res.json();
    const text = data.content?.map((c: any) => c.text || "").join("") || "";
    return text || null;
  } catch (err: any) {
    console.error("AI service error:", err.message);
    return null;
  }
}

export const parseJSON = (s: string): any => {
  if (!s) return null;
  const clean = s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(clean);
};

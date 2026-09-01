import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are a Canadian AI policy briefing agent. Scan major Canadian news sources and produce a short, accessible briefing note suitable for a classroom audience.

## Instructions

1. **Search for recent AI news** using your web search tool across these Canadian sources (search them ONE AT A TIME sequentially, NOT in parallel):
   - CBC News (cbc.ca)
   - Globe and Mail (theglobeandmail.com)
   - BetaKit (betakit.com)
   - The Logic (thelogic.co)

   For each source, use the domain filter to restrict results. Note: nationalpost.com is blocked — skip it.

2. **For the most important articles**, fetch full content using your web search tool.

3. **Synthesize** into the briefing format below. Keep it concise — this is for a class, not a policy shop.

## Output Format

Return ONLY the briefing in this markdown format:

# AI Policy Brief — [Full Date]
**Topic:** [topic or "General AI Policy Scan"]
**Sources:** CBC, Globe and Mail, BetaKit, The Logic

---

## Top Takeaways

1. **[Headline takeaway]** — [2-3 sentences explaining what happened and why it matters]

2. **[Headline takeaway]** — [2-3 sentences]

3. **[Headline takeaway]** — [2-3 sentences]

(up to 5 max)

## What to Watch
- [1-3 bullet points on emerging threads]

## Sources
- [Article title — Outlet](url)

## Guidelines
- MAX 3-5 takeaways. Be selective — only the most significant developments.
- Keep each takeaway to 2-3 sentences. No long paragraphs.
- Write in plain, accessible language — this is for students, not policy wonks.
- Prioritize Canadian context: regulation, investment, sovereignty, competitiveness
- Flag developments related to: AI safety/regulation, compute infrastructure, AI talent, trade/tariff implications
- If a source is paywalled or unavailable, skip it and move on`;

const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const requestLog = [];

function isRateLimited() {
  const now = Date.now();
  while (requestLog.length > 0 && requestLog[0] < now - RATE_LIMIT_WINDOW) {
    requestLog.shift();
  }
  if (requestLog.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  requestLog.push(now);
  return false;
}

async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit =
        err?.status === 429 ||
        (err?.message && err.message.includes("rate_limit"));
      if (isRateLimit && attempt < maxRetries) {
        const waitMs = (attempt + 1) * 15000; // 15s, 30s, 45s
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (isRateLimited()) {
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please wait a minute and try again.",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { topic } = await req.json();
    const userMessage = topic
      ? `Generate an AI policy briefing focused on: ${topic}`
      : `Generate a general AI policy scan briefing for today.`;

    const client = new Anthropic();

    const response = await callWithRetry(() =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 10,
          },
        ],
        messages: [{ role: "user", content: userMessage }],
      })
    );

    let briefing = "";
    for (const block of response.content) {
      if (block.type === "text") {
        briefing += block.text;
      }
    }

    return new Response(JSON.stringify({ briefing }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("Brief generation error:", err);
    const message = err?.message || String(err);

    // Friendly error for rate limits
    if (message.includes("rate_limit")) {
      return new Response(
        JSON.stringify({
          error:
            "The service is busy right now. Please wait a minute and try again.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Failed to generate briefing. Please try again in a moment.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
};

export const config = {
  path: "/api/brief",
};

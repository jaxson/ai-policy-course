import crypto from "node:crypto";
import dns from "node:dns";
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";

// API connections sometimes stalled on IPv6 from Netlify; prefer IPv4.
dns.setDefaultResultOrder("ipv4first");

// Public demo: a cheaper model, tight caps, and daily limits.
const MODEL = "claude-sonnet-5-5";
const DAILY_PER_VISITOR = 3;
const DAILY_TOTAL = 60;

// Counters live in Netlify Blobs under a hash of day + IP; no IP is stored.
async function claimDailyQuota(ip) {
  try {
    const store = getStore({ name: "demo-usage", consistency: "strong" });
    const day = new Date().toISOString().slice(0, 10);
    const visitor = crypto.createHash("sha256").update(`${day}:${ip}`).digest("hex").slice(0, 32);
    const mineKey = `visitor/${day}/${visitor}`;
    const totalKey = `total/${day}`;
    const [mine, total] = await Promise.all([store.get(mineKey), store.get(totalKey)]);
    const used = Number(mine) || 0;
    const usedTotal = Number(total) || 0;
    if (usedTotal >= DAILY_TOTAL) {
      return "This demo has reached its daily limit for all visitors. It is for demonstration purposes only. Please try again tomorrow.";
    }
    if (used >= DAILY_PER_VISITOR) {
      return `You've reached today's limit of ${DAILY_PER_VISITOR} briefings. This demo is for demonstration purposes only. Please come back tomorrow.`;
    }
    await Promise.all([store.set(mineKey, String(used + 1)), store.set(totalKey, String(usedTotal + 1))]);
    return null;
  } catch (err) {
    console.error("usage store unavailable", err?.message ?? "");
    return null;
  }
}

const SYSTEM_PROMPT = `You are a Canadian AI policy briefing agent. Scan major Canadian news sources and produce a short, accessible briefing note suitable for a classroom audience.

## Instructions

1. **Search for recent AI news** with your web search tool. You have at most 3 searches, so pick the most useful of these Canadian sources:
   - CBC News (cbc.ca)
   - Globe and Mail (theglobeandmail.com)
   - BetaKit (betakit.com)
   - The Logic (thelogic.co)

   Search is already limited to these four sites. Use plain search queries; do not add site: operators.

2. Write nothing before or between searches. Your first words must be the briefing itself.

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

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  const limitMessage = await claimDailyQuota(ip);
  if (limitMessage) {
    return new Response(JSON.stringify({ error: limitMessage }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let topic = null;
  try {
    ({ topic } = await req.json());
  } catch {
    topic = null;
  }
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Toronto", year: "numeric", month: "long", day: "numeric",
  });
  const userMessage = (topic
    ? `Generate an AI policy briefing focused on: ${String(topic).slice(0, 200)}`
    : `Generate a general AI policy scan briefing for today.`) + ` Today's date is ${today}; use it in the title and prefer news from the last few weeks.`;

  // A briefing takes 20-40 seconds, and Netlify's edge drops a response that
  // sends nothing for about 30. Send a space every 5 seconds (JSON allows
  // leading whitespace), then the JSON body.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const heartbeat = setInterval(() => {
        try { controller.enqueue(encoder.encode(" ")); } catch { /* closed */ }
      }, 5000);
      let payload;
      try {
        const client = new Anthropic({ maxRetries: 1, timeout: 50_000 });
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4000,
          thinking: { type: "between_tools" },
          output_config: { effort: "low" },
          system: SYSTEM_PROMPT,
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 3,
              allowed_domains: ["cbc.ca", "theglobeandmail.com", "betakit.com", "thelogic.co"],
            },
          ],
          messages: [{ role: "user", content: userMessage }],
        });

        if (response.stop_reason === "refusal") {
          payload = { error: "That topic could not be briefed. Please try a different one." };
        } else {
          const searchErrors = response.content
            .filter((b) => b.type === "web_search_tool_result" && b.content && !Array.isArray(b.content))
            .map((b) => b.content.error_code);
          console.log(JSON.stringify({ searches: response.usage?.server_tool_use?.web_search_requests ?? 0, searchErrors, stop: response.stop_reason }));
          // Text written before or between searches is narration. Keep only
          // the text after the last search result: that is the briefing.
          let lastTool = -1;
          response.content.forEach((block, i) => {
            if (block.type === "server_tool_use" || block.type === "web_search_tool_result") lastTool = i;
          });
          let briefing = "";
          response.content.slice(lastTool + 1).forEach((block) => {
            if (block.type === "text") briefing += block.text;
          });
          payload = briefing
            ? { briefing }
            : { error: "Failed to generate briefing. Please try again in a moment." };
        }
      } catch (err) {
        console.error("Brief generation error:", err?.status ?? "", err?.message ?? "");
        payload = {
          error:
            err instanceof Anthropic.RateLimitError
              ? "The service is busy right now. Please wait a minute and try again."
              : "Failed to generate briefing. Please try again in a moment.",
        };
      } finally {
        clearInterval(heartbeat);
      }
      controller.enqueue(encoder.encode(JSON.stringify(payload)));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-transform",
      "Access-Control-Allow-Origin": "*",
    },
  });
};

export const config = {
  path: "/api/brief",
};

import express from "express";

const router = express.Router();

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

// Resolved per request: dotenv.config() runs in server/index.js after this
// module is imported, so module-scope env reads would miss server/.env.
// gemini-2.5-flash is refused for newer keys ("no longer available to new
// users"), so the fallback is a model verified against this project's key.
function resolveModel() {
  return process.env.GEMINI_MODEL || "gemini-3.7-flash";
}

// The assistant answers from metrics computed in application code, so it needs
// room to reason over the supplied numbers without being free to invent trades.
const SYSTEM_INSTRUCTION = `You are EdgeFlo's AI Trading Assistant, speaking to a retail trader about their own trading journal.

STRICT RULES:
1. Answer only from the VERIFIED TRADING DATA block supplied with each request. It is computed by the application from the user's own journal and is the only trustworthy source of numbers.
2. Never invent trades, prices, dates, symbols, or statistics. Never restate a number that is not in the data block.
3. If the data block does not contain what is needed to answer, say exactly which data is missing and what the user can do to record it. Never guess to fill a gap.
4. Distinguish correlation from causation. With fewer than about 20 closed trades, describe results as "in this sample" and avoid claiming a proven pattern.
5. Be concrete and analytical: reference the actual figures, and separate observation from interpretation.
6. You are not a licensed financial adviser. Do not tell the user to buy or sell a specific instrument, do not promise returns, and do not recommend leverage or position sizes beyond general risk-management practice.
7. Format in short markdown: a brief lead sentence, then bullets where useful. No top-level heading, no tables, no emoji. Keep it under 220 words unless the user asked for a detailed breakdown.
8. If the user asks something unrelated to their trading, answer briefly and steer back to their journal.`;

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_HISTORY_CHARS = 8000;
const MAX_CONTEXT_CHARS = 24000;
const REQUEST_TIMEOUT_MS = 45000;

function textOf(value, limit) {
  return String(value ?? "").trim().slice(0, limit);
}

// Only role and text are forwarded; anything else the client sends (tokens,
// account identifiers, unexpected objects) is dropped here.
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.text === "string"
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item) => ({
      role: item.role,
      text: textOf(item.text, 4000),
    }))
    .filter((item) => item.text.length > 0);
}

function budgetHistory(messages) {
  const kept = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    used += messages[index].text.length;
    if (used > MAX_HISTORY_CHARS) break;
    kept.unshift(messages[index]);
  }

  return kept;
}

function buildContextBlock(context) {
  if (!context || typeof context !== "object") {
    return "VERIFIED TRADING DATA:\n{\n  \"note\": \"No trading data was supplied with this request.\"\n}";
  }

  const json = JSON.stringify(context, null, 1);

  if (json.length <= MAX_CONTEXT_CHARS) {
    return `VERIFIED TRADING DATA (computed by the application, authoritative):\n${json}`;
  }

  return `VERIFIED TRADING DATA (computed by the application, authoritative):\n${json.slice(0, MAX_CONTEXT_CHARS)}\n// …truncated by the server; treat the remaining detail as unavailable rather than guessing.`;
}

function geminiError(data, fallback) {
  const message =
    data?.error?.message ||
    data?.error?.status ||
    fallback;

  return message;
}

// Google reports a 429 window either as a google.rpc.RetryInfo detail
// ("retryDelay": "20h10m30s") or inside the human-readable message ("Please
// retry in 20h10m30s."). Only the duration is read: the provider message is
// never forwarded because it carries project numbers and internal limit names.
const RETRY_DELAY_RE = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?$/;

function secondsOf(rawDelay) {
  const match = RETRY_DELAY_RE.exec(
    String(rawDelay ?? "").trim().replace(/[.,;]$/, "")
  );

  if (!match || match.slice(1).every((part) => !part)) return null;

  const [, days, hours, minutes, seconds] = match;

  return (
    Number(days || 0) * 86400 +
    Number(hours || 0) * 3600 +
    Number(minutes || 0) * 60 +
    Math.floor(Number(seconds || 0))
  );
}

function detailOf(error, suffix) {
  const details = Array.isArray(error?.details) ? error.details : [];

  return details.find((detail) =>
    String(detail?.["@type"] || "").endsWith(suffix)
  );
}

function retrySecondsOf(error) {
  const retryInfo = secondsOf(detailOf(error, "RetryInfo")?.retryDelay);

  if (retryInfo !== null) return retryInfo;

  return secondsOf(
    String(error?.message || "").match(/retry\s+in\s+(\S+)/i)?.[1]
  );
}

function humanDelay(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 1) return null;

  if (totalSeconds < 60) {
    return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours < 24) {
    if (!minutes) return `${hours} hour${hours === 1 ? "" : "s"}`;

    return `${hours}h ${minutes}m`;
  }

  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  return restHours ? `${days}d ${restHours}h` : `${days} day${days === 1 ? "" : "s"}`;
}

function isQuotaExhausted(error) {
  if (String(error?.status || "").toUpperCase() === "RESOURCE_EXHAUSTED") {
    return true;
  }

  const reason = String(detailOf(error, "ErrorInfo")?.reason || "").toUpperCase();

  if (reason.includes("QUOTA")) return true;

  return /exceeded your current quota|check your plan and billing|quota/i.test(
    String(error?.message || "")
  );
}

function rateLimitBody(error) {
  const retryIn = humanDelay(retrySecondsOf(error));

  if (isQuotaExhausted(error)) {
    return {
      success: false,
      code: "RATE_LIMITED",
      message: retryIn
        ? `Gemini's request quota for this model is exhausted. It resets in about ${retryIn}. Try again after that, or set GEMINI_MODEL in server/.env to a model your key still has quota for.`
        : "Gemini's request quota for this model is exhausted. Wait for the quota window to reset, or set GEMINI_MODEL in server/.env to a model your key still has quota for.",
    };
  }

  return {
    success: false,
    code: "RATE_LIMITED",
    message: retryIn
      ? `Gemini is temporarily rate limiting this server. Try again in about ${retryIn}.`
      : "Gemini is temporarily rate limiting this server. Wait a minute and try again.",
  };
}

function notConfigured(res) {
  return res.status(503).json({
    success: false,
    code: "AI_NOT_CONFIGURED",
    message:
      "No AI provider is configured on this EdgeFlo server. Add GEMINI_API_KEY to server/.env and restart the backend.",
  });
}

/* ============================================================
   GET /api/ai/status
   Lets the chat UI show a setup state before the first message.
============================================================ */

router.get("/status", (req, res) => {
  const configured = Boolean(process.env.GEMINI_API_KEY);

  res.json({
    success: true,
    configured,
    model: configured ? resolveModel() : null,
    message: configured
      ? "Gemini is configured."
      : "GEMINI_API_KEY is missing from server/.env.",
  });
});

/* ============================================================
   POST /api/ai/chat
============================================================ */

router.post("/chat", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return notConfigured(res);

  const message = textOf(req.body?.message, MAX_MESSAGE_CHARS);

  if (!message) {
    return res.status(400).json({
      success: false,
      code: "EMPTY_MESSAGE",
      message: "Send a message to the assistant.",
    });
  }

  const history = budgetHistory(sanitizeHistory(req.body?.history));
  const contextBlock = buildContextBlock(req.body?.context);
  const model = resolveModel();

  const body = {
    systemInstruction: {
      parts: [{ text: `${SYSTEM_INSTRUCTION}\n\n${contextBlock}` }],
    },
    contents: [
      ...history.map((item) => ({
        role: item.role,
        parts: [{ text: item.text }],
      })),
      { role: "user", parts: [{ text: message }] },
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      maxOutputTokens: 1200,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    const data = await response.json().catch(() => null);

    if (response.status === 429) {
      return res.status(429).json(rateLimitBody(data?.error));
    }

    const providerMessage = String(
      data?.error?.message || ""
    ).toLowerCase();

    if (
      providerMessage.includes("api key") ||
      providerMessage.includes("api_key")
    ) {
      return res.status(503).json({
        success: false,
        code: "INVALID_KEY",
        message:
          "Gemini rejected the configured API key. Check GEMINI_API_KEY in server/.env.",
      });
    }

    if (providerMessage.includes("not found")) {
      return res.status(503).json({
        success: false,
        code: "MODEL_UNAVAILABLE",
        message: `Gemini has no model named "${model}". Set GEMINI_MODEL in server/.env to a model your key can use.`,
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        code: "PROVIDER_ERROR",
        message: geminiError(
          data,
          `Gemini returned ${response.status}.`
        ),
      });
    }

    const candidate = data?.candidates?.[0];
    const text = (candidate?.content?.parts || [])
      .map((part) => part?.text || "")
      .join("")
      .trim();

    if (!text) {
      const blocked =
        candidate?.finishReason === "SAFETY" ||
        candidate?.finishReason === "PROHIBITED_CONTENT" ||
        candidate?.finishReason === "BLOCKLIST";

      return res.status(200).json({
        success: false,
        code: blocked ? "CONTENT_BLOCKED" : "EMPTY_RESPONSE",
        message: blocked
          ? "Gemini declined to answer this request."
          : "Gemini returned no text. Try rephrasing the question.",
      });
    }

    res.json({
      success: true,
      answer: text,
      model,
      usage: {
        promptTokens: data?.usageMetadata?.promptTokenCount ?? null,
        responseTokens:
          data?.usageMetadata?.candidatesTokenCount ?? null,
      },
    });
  } catch (error) {
    const aborted = error?.name === "AbortError";

    res.status(aborted ? 504 : 502).json({
      success: false,
      code: aborted ? "TIMEOUT" : "NETWORK",
      message: aborted
        ? "Gemini took too long to respond. Try again."
        : "EdgeFlo could not reach Gemini. Check this machine's internet connection.",
    });
  } finally {
    clearTimeout(timer);
  }
});

export default router;

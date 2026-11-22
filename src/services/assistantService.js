const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:4000";

export class AssistantError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AssistantError";
    this.code = code;
  }
}

async function readJson(response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// A 404 here means the running backend predates the /api/ai route, which is a
// restart problem rather than an AI problem, so it must read differently.
function interpret(response, data) {
  if (response.status === 404) {
    throw new AssistantError(
      "BACKEND_OUTDATED",
      "The EdgeFlo backend is running an older build without the AI endpoint. Restart it (npm run dev) to load /api/ai."
    );
  }

  throw new AssistantError(
    data?.code || "PROVIDER_ERROR",
    data?.message || `The assistant server responded with ${response.status}.`
  );
}

export async function getAssistantStatus() {
  try {
    const response = await fetch(`${API_URL}/api/ai/status`, {
      signal: AbortSignal.timeout(8000),
    });

    const data = await readJson(response);

    if (response.status === 404) {
      throw new AssistantError(
        "BACKEND_OUTDATED",
        "The EdgeFlo backend is running an older build without the AI endpoint. Restart it (npm run dev) to load /api/ai."
      );
    }

    if (!response.ok || !data) {
      throw new AssistantError(
        "BACKEND_UNAVAILABLE",
        "EdgeFlo's backend did not answer the AI status check."
      );
    }

    return {
      configured: Boolean(data.configured),
      model: data.model || null,
      message: data.message || "",
    };
  } catch (error) {
    if (error instanceof AssistantError) throw error;

    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new AssistantError(
        "BACKEND_TIMEOUT",
        "EdgeFlo's backend did not answer in time."
      );
    }

    throw new AssistantError(
      "BACKEND_OFFLINE",
      `EdgeFlo's backend is not reachable at ${API_URL}. Start the full app with npm run dev.`
    );
  }
}

export async function sendAssistantMessage({
  message,
  history = [],
  context = null,
}) {
  let response;

  try {
    response = await fetch(`${API_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history, context }),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new AssistantError(
        "TIMEOUT",
        "The request to the assistant timed out. Try again."
      );
    }

    throw new AssistantError(
      "BACKEND_OFFLINE",
      `EdgeFlo's backend is not reachable at ${API_URL}. Start the full app with npm run dev.`
    );
  }

  const data = await readJson(response);

  if (!response.ok) {
    interpret(response, data);
  }

  if (!data?.success || !data.answer) {
    throw new AssistantError(
      data?.code || "EMPTY_RESPONSE",
      data?.message || "The assistant returned no answer."
    );
  }

  return {
    answer: data.answer,
    model: data.model || null,
  };
}

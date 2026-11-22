import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  AssistantError,
  getAssistantStatus,
  sendAssistantMessage,
} from "../services/assistantService";

const STORAGE_KEY = "edgeflo_ai_session_v1";
const HISTORY_MESSAGES = 10;

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.messages)) return null;

    return {
      chatId: String(parsed.chatId ?? newId()),
      messages: parsed.messages
        .filter((item) => item && (item.role === "user" || item.role === "assistant"))
        .map((item) => ({
          id: String(item.id ?? newId()),
          role: item.role,
          text: String(item.text ?? ""),
          createdAt: Number(item.createdAt) || Date.now(),
          kind: item.kind === "error" ? "error" : "text",
          code: item.code ?? null,
        })),
    };
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // A full or disabled sessionStorage must not break the chat.
  }
}

export default function useAssistantChat({ buildContext }) {
  const restored = useMemo(() => readStoredSession(), []);

  const [chatId, setChatId] = useState(() => restored?.chatId ?? newId());
  const [messages, setMessages] = useState(() => restored?.messages ?? []);
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [provider, setProvider] = useState({
    checking: true,
    configured: null,
    model: null,
    message: "",
  });

  const sendInFlight = useRef(false);

  const refreshProvider = useCallback(async () => {
    try {
      const status = await getAssistantStatus();

      setProvider({
        checking: false,
        configured: status.configured,
        model: status.model,
        message: status.message,
      });
    } catch (error) {
      setProvider({
        checking: false,
        configured: false,
        model: null,
        message:
          error instanceof AssistantError
            ? error.message
            : "EdgeFlo's backend did not answer the AI status check.",
      });
    }
  }, []);

  useEffect(() => {
    refreshProvider();
  }, [refreshProvider]);

  useEffect(() => {
    writeStoredSession({ chatId, messages });
  }, [chatId, messages]);

  const submit = useCallback(
    async (rawText, options = {}) => {
      const text = String(rawText ?? "").trim();

      if (!text || sendInFlight.current) return false;

      // Retry re-uses the user bubble that is already on screen.
      const appendUser = options.appendUser !== false;

      sendInFlight.current = true;
      setSending(true);
      setRequestError(null);

      const base = appendUser ? messages : messages.slice(0, -1);

      const history = base
        .filter((message) => message.kind !== "error")
        .slice(-HISTORY_MESSAGES)
        .map((message) => ({ role: message.role, text: message.text }));

      if (appendUser) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "user",
            text,
            createdAt: Date.now(),
            kind: "text",
          },
        ]);
      }

      try {
        const context = buildContext ? buildContext() : null;

        const result = await sendAssistantMessage({
          message: text,
          history,
          context,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: result.answer,
            createdAt: Date.now(),
            kind: "text",
          },
        ]);

        return true;
      } catch (error) {
        const code = error instanceof AssistantError ? error.code : "UNKNOWN";
        const message = error?.message || "The assistant failed to respond.";

        setRequestError({ code, message });

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            text: message,
            createdAt: Date.now(),
            kind: "error",
            code,
          },
        ]);

        return false;
      } finally {
        sendInFlight.current = false;
        setSending(false);
      }
    },
    [buildContext, messages]
  );

  const lastUserText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") return messages[index].text;
    }

    return "";
  }, [messages]);

  const retry = useCallback(() => {
    if (!lastUserText) return;

    setMessages((prev) => {
      const withoutError = [...prev];

      if (
        withoutError.length > 0 &&
        withoutError[withoutError.length - 1].kind === "error"
      ) {
        withoutError.pop();
      }

      return withoutError;
    });

    submit(lastUserText, { appendUser: false });
  }, [lastUserText, submit]);

  const resetConversation = useCallback((startNewChat) => {
    setMessages([]);
    setRequestError(null);
    setSending(false);

    if (startNewChat) {
      setChatId(newId());
    }
  }, []);

  const startNewChat = useCallback(
    () => resetConversation(true),
    [resetConversation]
  );

  const clearConversation = useCallback(
    () => resetConversation(false),
    [resetConversation]
  );

  return {
    chatId,
    messages,
    sending,
    requestError,
    provider,
    send: submit,
    retry,
    startNewChat,
    clearConversation,
    refreshProvider,
  };
}

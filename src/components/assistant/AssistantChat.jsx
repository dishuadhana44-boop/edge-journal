import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";

import { useJournal } from "../../context/JournalContext";
import { useTrade } from "../../context/TradeContext";

import { buildAssistantContext } from "../../utils/assistant/tradingContextBuilder";
import { selectRealizedTrades } from "../../utils/dashboardCurveEngine";

import useAssistantChat from "../../hooks/useAssistantChat";
import useSpeechInput from "../../hooks/useSpeechInput";

import MessageBubble from "./MessageBubble";
import WelcomeScreen from "./WelcomeScreen";
import ChatComposer from "./ChatComposer";

const SUGGESTIONS = [
  "What is my win rate?",
  "Analyze my last 20 trades.",
  "Which trading mistakes do I repeat?",
  "Which day is most profitable?",
  "Summarize my performance this month.",
  "Why am I losing money?",
];

function loadTradingAccounts() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem("tradingAccounts") || "[]"
    );

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AssistantChat() {
  const {
    filteredTrades = [],
    selectedAccountId,
  } = useJournal();

  const { openTrades = [], pendingOrders = [] } = useTrade();

  const [draft, setDraft] = useState("");

  const account = useMemo(() => {
    return (
      loadTradingAccounts().find(
        (item) =>
          String(item?.id ?? item?.accountId) === String(selectedAccountId)
      ) ?? null
    );
  }, [selectedAccountId]);

  const closedTradeCount = useMemo(
    () => selectRealizedTrades(filteredTrades).length,
    [filteredTrades]
  );

  const buildContext = useCallback(
    () =>
      buildAssistantContext({
        trades: filteredTrades,
        account,
        openPositions: openTrades.length,
        pendingOrders: pendingOrders.length,
      }),
    [filteredTrades, account, openTrades.length, pendingOrders.length]
  );

  const {
    messages,
    sending,
    provider,
    send,
    retry,
    startNewChat,
    clearConversation,
    refreshProvider,
  } = useAssistantChat({ buildContext });

  const appendTranscript = useCallback((finalText) => {
    setDraft((prev) => {
      const base = prev.trim();
      return base ? `${base} ${finalText}` : finalText;
    });
  }, []);

  const speech = useSpeechInput({ onTranscript: appendTranscript });

  const scrollRef = useRef(null);
  const [pinnedToLatest, setPinnedToLatest] = useState(true);

  const handleScroll = () => {
    const node = scrollRef.current;

    if (!node) return;

    const distanceFromBottom =
      node.scrollHeight - node.scrollTop - node.clientHeight;

    setPinnedToLatest(distanceFromBottom < 90);
  };

  useEffect(() => {
    const node = scrollRef.current;

    if (!node || !pinnedToLatest) return;

    node.scrollTop = node.scrollHeight;
  }, [messages, sending, pinnedToLatest]);

  const jumpToLatest = () => {
    const node = scrollRef.current;

    if (!node) return;

    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    setPinnedToLatest(true);
  };

  const dispatch = useCallback(
    async (text) => {
      const trimmed = String(text ?? "").trim();

      if (!trimmed || sending) return;

      if (speech.listening) speech.stop();

      // Re-pin when the user sends, then leave the position alone: scrolling away
      // during a response must not be undone when the answer lands.
      setPinnedToLatest(true);

      setDraft("");
      await send(trimmed);
    },
    [send, sending, speech]
  );

  const setupNotice = useMemo(() => {
    if (provider.checking) {
      return {
        tone: "neutral",
        text: "Checking the assistant backend…",
      };
    }

    if (provider.configured) return null;

    return {
      tone: "warn",
      text: provider.message ||
        "No AI provider is configured on this server yet.",
    };
  }, [provider]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
      {/* ================= TOOLBAR ================= */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">
            {account
              ? String(account.accountName ?? account.name ?? "Trading account").replace(
                  /\d{5,}/g,
                  "•••"
                )
              : "No account selected"}
          </p>

          <p className="truncate text-[11px] text-gray-500">
            {selectedAccountId
              ? `${closedTradeCount} closed trade${closedTradeCount === 1 ? "" : "s"} available to analyse`
              : "Select an account in Settings to scope the analysis"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNewChat}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-violet-300 hover:text-violet-700"
            title="Begin a new conversation. The current transcript is discarded."
          >
            <Plus size={14} />
            Start New Chat
          </button>

          <button
            type="button"
            onClick={clearConversation}
            disabled={messages.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            title="Remove every message from this conversation"
          >
            <Trash2 size={14} />
            Clear Conversation
          </button>
        </div>
      </div>

      {/* ================= SETUP NOTICE ================= */}
      {setupNotice && (
        <div
          className={`shrink-0 border-b px-3 py-2.5 text-[12px] leading-5 sm:px-4 ${
            setupNotice.tone === "warn"
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-gray-200 bg-white text-gray-500"
          }`}
        >
          <div className="mx-auto flex max-w-3xl items-start gap-2">
            {setupNotice.tone === "warn" ? (
              <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
            ) : (
              <Loader2 size={15} className="mt-0.5 shrink-0 animate-spin" />
            )}

            <p className="flex-1">
              {setupNotice.text}
              {setupNotice.tone === "warn" && (
                <span className="block mt-1 text-amber-800">
                  The chat interface stays usable — add the key in
                  {" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
                    server/.env
                  </code>
                  {" "}
                  as
                  {" "}
                  <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
                    GEMINI_API_KEY
                  </code>
                  {" "}
                  and restart the backend.
                </span>
              )}
            </p>

            {setupNotice.tone === "warn" && (
              <button
                type="button"
                onClick={refreshProvider}
                className="shrink-0 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                <span className="inline-flex items-center gap-1">
                  <RefreshCw size={12} />
                  Check again
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= CONVERSATION ================= */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-4"
        >
          {messages.length === 0 ? (
            <WelcomeScreen
              suggestions={SUGGESTIONS}
              onAsk={dispatch}
              disabled={sending}
              dataNote={
                closedTradeCount === 0
                  ? "Your journal has no closed trades yet — the assistant will explain what it needs."
                  : `Reading ${closedTradeCount} closed trade${closedTradeCount === 1 ? "" : "s"} from your journal`
              }
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onRetry={retry}
                />
              ))}

              {sending && (
                <div className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <Loader2 size={16} className="animate-spin" />
                  </div>

                  <div className="rounded-2xl rounded-tl-md border border-gray-200 bg-white px-4 py-3 shadow-sm">
                    <p className="flex items-center gap-2 text-sm text-gray-500">
                      Computing your metrics and asking Gemini…
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!pinnedToLatest && messages.length > 0 && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-md transition hover:border-violet-300 hover:text-violet-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <ArrowDown size={13} />
              Jump to latest
            </span>
          </button>
        )}
      </div>

      {/* ================= COMPOSER ================= */}
      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSend={() => dispatch(draft)}
        sending={sending}
        listening={speech.listening}
        interimText={speech.interimText}
        micSupported={speech.supported}
        micError={speech.error}
        onMicToggle={speech.listening ? speech.stop : speech.start}
        onDismissMicError={speech.clearError}
      />

      <p className="shrink-0 border-t border-gray-100 bg-white px-4 py-2 text-center text-[11px] leading-4 text-gray-400">
        <Info size={11} className="mr-1 inline-block align-[-1px]" />
        The AI can make mistakes — verify important trading decisions.
      </p>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { Loader2, Mic, MicOff, Send, X } from "lucide-react";

export default function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  listening,
  interimText,
  micSupported,
  micError,
  onMicToggle,
  onDismissMicError,
}) {
  const textareaRef = useRef(null);

  // Grow with the message but stop before the composer eats the conversation.
  useEffect(() => {
    const node = textareaRef.current;

    if (!node) return;

    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !sending;

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (canSend) onSend();
    }
  };

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
      {micError && (
        <div className="mx-auto mb-2 flex max-w-3xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          <MicOff size={14} className="mt-0.5 shrink-0" />

          <p className="flex-1">{micError}</p>

          <button
            type="button"
            onClick={onDismissMicError}
            className="shrink-0 rounded-md p-1 text-amber-600 transition hover:bg-amber-100"
            aria-label="Dismiss microphone message"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {listening && (
        <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-600" />
          </span>

          <p className="flex-1 truncate">
            {interimText ? `Listening — ${interimText}` : "Listening — speak now"}
          </p>

          <span className="shrink-0 text-[11px] text-violet-500">
            transcript lands in the box for you to review
          </span>
        </div>
      )}

      <div
        className={`mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm transition ${
          listening ? "border-violet-400" : "border-gray-200 focus-within:border-violet-400"
        }`}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          placeholder={
            sending
              ? "Assistant is responding…"
              : "Ask about your win rate, mistakes, best symbol, this month…"
          }
          className="max-h-[168px] min-h-[24px] flex-1 resize-none border-0 bg-transparent px-1 py-1 text-sm leading-6 text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
          aria-label="Message the AI Trading Assistant"
        />

        {micSupported && (
          <button
            type="button"
            onClick={onMicToggle}
            aria-pressed={listening}
            title={listening ? "Stop listening" : "Dictate your question"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
              listening
                ? "bg-violet-600 text-white"
                : "border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600"
            }`}
          >
            {listening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
        )}

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          title="Send message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>

      <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-3 px-1">
        <p className="text-[11px] leading-4 text-gray-400">
          Enter sends · Shift+Enter adds a new line
        </p>

        {sending && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600">
            <Loader2 size={12} className="animate-spin" />
            Assistant is analysing your journal
          </p>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

function getRecognitionConstructor() {
  if (typeof window === "undefined") return null;

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

const ERROR_MESSAGES = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser settings, or keep typing.",
  "service-not-allowed": "The browser blocked the speech service. You can still type your question.",
  "no-speech": "No speech was detected. Try again, or type your question.",
  network: "The speech service could not be reached. Check your connection or type your question.",
  "audio-capture": "No microphone was found. You can still type your question.",
  "language-not-supported": "This browser cannot dictate in the selected language.",
  aborted: "",
};

// Browser-only dictation: the transcript is handed back to the composer for the
// user to review and edit, and is never sent automatically.
export default function useSpeechInput({ onTranscript, lang = "en-US" }) {
  const [supported] = useState(() => Boolean(getRecognitionConstructor()));
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef(onTranscript);

  useEffect(() => {
    transcriptRef.current = onTranscript;
  }, [onTranscript]);

  const teardown = useCallback(() => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (!recognition) return;

    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;

    try {
      recognition.abort();
    } catch {
      // The session is already gone.
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;

    if (!recognition) return;

    try {
      recognition.stop();
    } catch {
      teardown();
    }

    setListening(false);
    setInterimText("");
  }, [teardown]);

  const start = useCallback(() => {
    const Constructor = getRecognitionConstructor();

    if (!Constructor) {
      setError("This browser has no built-in speech recognition. Type your question instead.");
      return;
    }

    if (recognitionRef.current) {
      stop();
      return;
    }

    setError(null);
    setInterimText("");

    const recognition = new Constructor();

    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let interim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? "";

        if (result.isFinal) {
          const finalText = text.trim();

          if (finalText) {
            transcriptRef.current?.(finalText);
          }
        } else {
          interim += text;
        }
      }

      setInterimText(interim.trim());
    };

    recognition.onerror = (event) => {
      const code = event?.error || "unknown";
      const message = ERROR_MESSAGES[code] ?? `Voice input failed (${code}).`;

      if (message) setError(message);

      setListening(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setListening(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setError("Voice input could not start. You can still type your question.");
      setListening(false);
    }
  }, [lang, stop]);

  useEffect(() => teardown, [teardown]);

  return {
    supported,
    listening,
    interimText,
    error,
    clearError: () => setError(null),
    start,
    stop,
  };
}

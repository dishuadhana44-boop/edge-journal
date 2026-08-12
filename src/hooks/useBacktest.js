// src/hooks/useBacktest.js
// Drives candle-by-candle replay: play/pause/step/scrub/speed control.
// Feed it a full historical candle array (from twelveData.js) and it reveals
// candles one at a time, like a live market replaying in the past.

import { useState, useRef, useCallback, useEffect } from "react";

const DEFAULT_SEED = 50; // how many candles are visible before playback starts

export function useBacktest(fullCandleSet = []) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(DEFAULT_SEED, fullCandleSet.length)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // candles revealed per second

  const intervalRef = useRef(null);

  // Reset playback whenever a brand new candle set is loaded
  // (e.g. user picks a new symbol/date range)
  useEffect(() => {
    setCurrentIndex(Math.min(DEFAULT_SEED, fullCandleSet.length));
    setIsPlaying(false);
    clearInterval(intervalRef.current);
  }, [fullCandleSet]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const play = useCallback(() => {
    if (fullCandleSet.length === 0) return;
    clearTimer();
    setIsPlaying(true);

    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => {
        if (i >= fullCandleSet.length) {
          clearTimer();
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1000 / speed);
  }, [speed, fullCandleSet.length]);

  const pause = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
  }, []);

  const step = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, fullCandleSet.length));
  }, [fullCandleSet.length]);

  const stepBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 1));
  }, []);

  const scrubTo = useCallback(
    (index) => {
      setCurrentIndex(Math.max(1, Math.min(index, fullCandleSet.length)));
    },
    [fullCandleSet.length]
  );

  const reset = useCallback(() => {
    pause();
    setCurrentIndex(Math.min(DEFAULT_SEED, fullCandleSet.length));
  }, [fullCandleSet.length, pause]);

  // If speed changes while playing, restart the timer at the new rate
  useEffect(() => {
    if (isPlaying) {
      play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // Cleanup on unmount
  useEffect(() => clearTimer, []);

  const visibleCandles = fullCandleSet.slice(0, currentIndex);
  const currentCandle = fullCandleSet[currentIndex - 1] || null;
  const isFinished = currentIndex >= fullCandleSet.length && fullCandleSet.length > 0;
  const progress =
    fullCandleSet.length > 0 ? currentIndex / fullCandleSet.length : 0;

  return {
    visibleCandles,   // feed this array to your chart
    currentCandle,    // the "latest" candle right now — use for trade fills
    currentIndex,
    totalCandles: fullCandleSet.length,
    isPlaying,
    isFinished,
    progress,          // 0 to 1, useful for a scrub bar
    speed,
    setSpeed,
    play,
    pause,
    step,
    stepBack,
    scrubTo,
    reset,
  };
}
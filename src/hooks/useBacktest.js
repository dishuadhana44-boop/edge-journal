// src/hooks/useBacktest.js
// Bar Replay engine: reveals historical candles one at a time so the trader
// only ever sees prices up to the replay cursor. Candles past the cursor are
// never handed to the chart or to the simulation engine.

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const DEFAULT_SEED = 50;

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, 16];

export function useBacktest(fullCandleSet = [], initialCursor = null) {
  const candles = useMemo(
    () => (Array.isArray(fullCandleSet) ? fullCandleSet : []),
    [fullCandleSet]
  );

  const [cursor, setCursor] = useState(() => {
    if (candles.length === 0) return 0;
    if (!Number.isFinite(initialCursor)) return Math.min(DEFAULT_SEED, candles.length);
    return Math.max(1, Math.min(Math.round(initialCursor), candles.length));
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const timerRef = useRef(null);

  // A freshly loaded (or re-loaded) series is revealed from the seed candle, or
  // from `resumeAt` when a saved backtest is reopened.
  const applyDataset = useCallback((total, resumeAt) => {
    setIsPlaying(false);

    const fallback = Math.min(DEFAULT_SEED, total);
    const target = Number.isFinite(resumeAt)
      ? Math.max(1, Math.min(Math.round(resumeAt), total))
      : fallback;

    setCursor(Math.min(target, total));
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // One interval per playing state; the rate is rebuilt only when speed or the
  // dataset changes, so pressing play never rewinds the cursor.
  useEffect(() => {
    clearTimer();

    if (!isPlaying || candles.length === 0) return;

    const delay = Math.max(20, 1000 / speed);

    timerRef.current = setInterval(() => {
      setCursor((index) => {
        if (index >= candles.length) {
          setIsPlaying(false);
          clearTimer();
          return index;
        }
        return index + 1;
      });
    }, delay);

    return clearTimer;
  }, [isPlaying, speed, candles.length, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const play = useCallback(() => {
    if (candles.length === 0) return;
    if (cursor >= candles.length) return;
    setIsPlaying(true);
  }, [candles.length, cursor]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const togglePlay = useCallback(() => {
    setIsPlaying((playing) => {
      if (playing) return false;
      return candles.length > 0 && cursor < candles.length;
    });
  }, [candles.length, cursor]);

  const step = useCallback(() => {
    setIsPlaying(false);
    setCursor((index) => Math.min(index + 1, candles.length));
  }, [candles.length]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setCursor((index) => Math.max(index - 1, 1));
  }, []);

  const scrubTo = useCallback(
    (index) => {
      setIsPlaying(false);
      setCursor(Math.max(1, Math.min(Math.round(index), candles.length)));
    },
    [candles.length]
  );

  const reset = useCallback(() => {
    applyDataset(candles.length);
  }, [applyDataset, candles.length]);

  const seekToTimestamp = useCallback(
    (timestamp) => {
      let best = -1;
      let bestGap = Infinity;

      for (let i = 0; i < candles.length; i += 1) {
        const gap = Math.abs(candles[i].time - timestamp);
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      }

      if (best === -1) return false;
      scrubTo(best + 1);
      return true;
    },
    [candles, scrubTo]
  );

  const visibleCandles = candles.slice(0, cursor);
  const currentCandle = candles[cursor - 1] || null;
  const isFinished = candles.length > 0 && cursor >= candles.length;
  const progress = candles.length > 0 ? cursor / candles.length : 0;

  return {
    visibleCandles,
    currentCandle,
    currentIndex: cursor,
    totalCandles: candles.length,
    isPlaying,
    isFinished,
    progress,
    speed,
    setSpeed,
    play,
    pause,
    togglePlay,
    step,
    stepBack,
    scrubTo,
    seekToTimestamp,
    reset,
    applyDataset,
    seedCount: DEFAULT_SEED,
  };
}

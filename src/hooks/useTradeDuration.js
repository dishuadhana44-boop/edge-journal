import { useEffect, useState } from "react";

export default function useTradeDuration(openedAt) {

  const [duration, setDuration] = useState("00:00:00");

  useEffect(() => {

    const interval = setInterval(() => {

      const now = new Date();

      const start = new Date(openedAt);

      const diff = Math.floor((now - start) / 1000);

      const hrs = String(Math.floor(diff / 3600)).padStart(2, "0");
      const mins = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const secs = String(diff % 60).padStart(2, "0");

      setDuration(`${hrs}:${mins}:${secs}`);

    }, 1000);

    return () => clearInterval(interval);

  }, [openedAt]);

  return duration;
}
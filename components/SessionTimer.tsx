"use client";

import React, { useEffect, useRef, useState } from "react";

const formatMs = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

interface SessionTimerProps {
  storageKey?: string;
  initialMinutes?: number;
  autoStart?: boolean;
  onFinish?: () => void;
  onStop?: () => void;
}

const SessionTimer: React.FC<SessionTimerProps> = ({
  storageKey = "session-timer",
  initialMinutes = 3,
  autoStart = true,
  onFinish,
  onStop,
}) => {
  const initialMs = initialMinutes * 60 * 1000;
  const [running, setRunning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(initialMs);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const persist = (obj: object) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch (e) {
      console.warn("SessionTimer persist error", e);
    }
  };

  // On mount: restore from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        let rem: number = typeof parsed.remainingMs === "number" ? parsed.remainingMs : initialMs;
        if (parsed.running && parsed.lastUpdated) {
          rem = Math.max(0, rem - (Date.now() - parsed.lastUpdated));
        }
        setRemainingMs(rem);
        if (autoStart && rem > 0) {
          persist({ running: true, remainingMs: rem, lastUpdated: Date.now() });
          setRunning(true);
        }
      } else {
        setRemainingMs(initialMs);
        if (autoStart) {
          persist({ running: true, remainingMs: initialMs, lastUpdated: Date.now() });
          setRunning(true);
        }
      }
    } catch {
      setRemainingMs(initialMs);
      if (autoStart) {
        persist({ running: true, remainingMs: initialMs, lastUpdated: Date.now() });
        setRunning(true);
      }
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        setRemainingMs((prev) => {
          const next = Math.max(0, prev - 250);
          if (next === 0) {
            if (tickRef.current) clearInterval(tickRef.current);
            setRunning(false);
            persist({ running: false, remainingMs: 0, lastUpdated: null });
            onFinish?.();
            onStop?.();
          } else {
            persist({ running: true, remainingMs: next, lastUpdated: Date.now() });
          }
          return next;
        });
      }, 250);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      persist({ running: false, remainingMs, lastUpdated: null });
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handlePause = () => setRunning(false);
  const handleResume = () => setRunning(true);
  const handleReset = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRemainingMs(initialMs);
    persist({ running: true, remainingMs: initialMs, lastUpdated: Date.now() });
    setRunning(true);
  };

  const btnStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 6,
    background: "#1496f3",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{formatMs(remainingMs)}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {running ? (
          <button onClick={handlePause} style={btnStyle}>Pause</button>
        ) : (
          <button onClick={handleResume} style={btnStyle}>Resume</button>
        )}
        <button onClick={handleReset} style={btnStyle}>Reset</button>
      </div>
    </div>
  );
};

export default SessionTimer;
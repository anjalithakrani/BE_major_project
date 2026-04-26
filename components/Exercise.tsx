"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SessionTimer from "./SessionTimer";
import useSpeechFeedback from "./useSpeechFeedback";

export interface ExerciseProps {
  title: string;
  statusUrl: string;
  liveUrl: string;
  videoSrc: string;
  repsTarget?: number;
  sessionId?: string | null;
  isSessionActive?: boolean;
  sessionError?: string | null;
  updateLive?: (reps: number, labelCounts: Record<string, Record<string, number>>) => void;
  onRequestEnd?: () => void;
  videoStyle?: React.CSSProperties;
}

const mapData = (data: Record<string, unknown>) => ({
  counters: (data.counters as Record<string, number>) ?? {},
  feedback: (data.feedback as Record<string, string>) ?? {},
  model_feedback: (data.model_feedback as Record<string, string>) ?? {},
});

const Exercise: React.FC<ExerciseProps> = ({
  title,
  statusUrl,
  liveUrl,
  videoSrc,
  repsTarget = 10,
  sessionId,
  isSessionActive,
  sessionError,
  updateLive,
  onRequestEnd,
  videoStyle,
}) => {
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [modelFeedback, setModelFeedback] = useState<Record<string, string>>({});
  const [labelCounts, setLabelCounts] = useState<Record<string, Record<string, number>>>({});

  const prevCountersRef = useRef<Record<string, number>>({});
  const labelCountsRef = useRef<Record<string, Record<string, number>>>({});

  const { audioEnabled, enableAudio } = useSpeechFeedback(counters, feedback, modelFeedback);

  const endSession = onRequestEnd ?? (() => {});
  const update = updateLive ?? (() => {});

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(statusUrl);
        const data: Record<string, unknown> = await res.json();
        const mapped = mapData(data);

        const newLabelCounts = { ...labelCountsRef.current };
        Object.keys(mapped.counters).forEach((key) => {
          const prev = prevCountersRef.current[key] ?? 0;
          const curr = mapped.counters[key] ?? 0;
          const diff = curr - prev;
          if (diff > 0) {
            const label = mapped.model_feedback?.[key];
            if (label && label !== "none") {
              newLabelCounts[key] = {
                ...newLabelCounts[key],
                [label]: ((newLabelCounts[key]?.[label]) ?? 0) + diff,
              };
            }
          }
        });

        const totalReps = Object.values(mapped.counters).reduce((a, b) => a + b, 0);
        labelCountsRef.current = newLabelCounts;
        setCounters(mapped.counters);
        setFeedback(mapped.feedback);
        setModelFeedback(mapped.model_feedback);
        setLabelCounts(newLabelCounts);
        prevCountersRef.current = { ...mapped.counters };
        update(totalReps, newLabelCounts);
      } catch (err) {
        console.error(`Error fetching ${title} status:`, err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [statusUrl, title, update]);

  useEffect(() => {
    const handleUnload = () => { endSession(); };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [endSession]);

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", color: "#232323" }}>

      {/* ── Header ── */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          padding: "18px 44px 12px",
          gap: 18,
        }}
      >
        <Link
          href="/patient/progress"
          onClick={endSession}
          style={{
            fontWeight: 500,
            color: "#232323",
            textDecoration: "none",
            fontSize: "1.11rem",
            background: "#fff",
            borderRadius: 4,
            padding: "7px 18px",
            border: "1px solid #ececec",
          }}
        >
          ← Back
        </Link>

        <span style={{ fontWeight: 700, fontSize: "1.42rem" }}>{title}</span>

        <div style={{ flex: 1 }} />

        {sessionId && (
          <span
            style={{
              fontSize: "0.82rem",
              color: isSessionActive ? "#4CAF50" : "#999",
              fontWeight: 600,
            }}
          >
            {isSessionActive ? "● Recording" : "● Saved"}
          </span>
        )}
        {sessionError && (
          <span style={{ fontSize: "0.82rem", color: "#e53e3e" }}>
            ⚠ {sessionError}
          </span>
        )}

        {isSessionActive && (
          <button
            onClick={endSession}
            style={{
              padding: "8px 22px",
              background: "#e53e3e",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            End Session
          </button>
        )}
      </div>

      <main
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 44px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 34,
        }}
      >
        <div style={{ display: "flex", gap: 32, marginBottom: 10, position: "relative" }}>

          {/* AI Instructor */}
          <div
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: 10,
              padding: "30px 28px",
              minWidth: 350,
              boxShadow: "0 2px 12px rgba(42,53,112,0.1)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 7,
                width: "100%",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "1.26rem" }}>AI Instructor</div>
              <button
                onClick={enableAudio}
                style={{
                  fontSize: "0.85rem",
                  background: audioEnabled ? "#4CAF50" : "#eef3fc",
                  color: audioEnabled ? "#fff" : "#232323",
                  border: "none",
                  borderRadius: 10,
                  padding: "6px 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {audioEnabled ? "🎤 Audio On" : "🎤 Enable Audio"}
              </button>
            </div>

            <video
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: "100%",
                maxHeight: 280,
                borderRadius: 10,
                objectFit: "cover",
                background: "#000",
                  ...videoStyle
              }}
            />
          </div>

          {/* Your Form */}
          <div
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: 10,
              padding: 16,
              minWidth: 350,
              minHeight: 400,
              boxShadow: "0 2px 12px rgba(42,53,112,0.1)",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                marginBottom: 20,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 24 }}>Your Form</span>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={liveUrl}
              alt={`${title} live feed`}
              style={{
                width: "100%",
                height: 340,
                borderRadius: 10,
                objectFit: "cover",
                background: "#000",
              }}
            />
          </div>

          {/* Session timer */}
          <div
            style={{
              position: "absolute",
              right: 250,
              top: -65,
              padding: "10px 12px",
              borderRadius: 8,
              zIndex: 20,
            }}
          >
            <SessionTimer
              storageKey={`session-${title}`}
              initialMinutes={3}
              autoStart={true}
              onFinish={endSession}
            />
          </div>
        </div>

        {/* ── Feedback panel ── */}
        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: "34px 30px",
              minWidth: 560,
              boxShadow: "0 2px 14px rgba(42,53,112,0.13)",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: "1.21rem",
                color: "#232323",
                marginBottom: 16,
              }}
            >
              Feedback
            </div>

            {Object.keys(counters).length === 0 && (
              <p style={{ color: "#999", fontSize: "0.9rem" }}>
                Waiting for exercise data...
              </p>
            )}

            {Object.keys(counters).map((key) => (
              <div key={key} style={{ marginBottom: 12, textAlign: "center" }}>
                <p style={{ margin: "0 0 4px" }}>
                  <strong>{key}:</strong> {counters[key]} reps
                  {feedback[key] ? ` | ${feedback[key]}` : ""}
                  {modelFeedback[key] && modelFeedback[key] !== "none"
                    ? ` | 🤖 ${modelFeedback[key]}`
                    : ""}
                </p>
                {labelCounts[key] && (
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "#666",
                      display: "flex",
                      gap: 10,
                      justifyContent: "center",
                    }}
                  >
                    {Object.entries(labelCounts[key]).map(([label, count]) => (
                      <span key={label}>
                        {label}: <strong>{count}</strong>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Exercise;
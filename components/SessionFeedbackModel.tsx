"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface SessionFeedbackModalProps {
  sessionId: string;
  onDone: () => void;
  onSkip: () => void;
}

// Maps UI string → DB integer (difficulty_level is int 1-5 in schema)
const DIFFICULTY_MAP: Record<string, number> = {
  easy: 2,
  moderate: 3,
  hard: 5,
};

// Maps UI string → DB enum (mood allows: excellent/good/neutral/poor/terrible)
const MOOD_MAP: Record<string, string> = {
  bad: "poor",
  okay: "neutral",
  good: "good",
  excellent: "excellent",
};

export function SessionFeedbackModal({ sessionId, onDone, onSkip }: SessionFeedbackModalProps) {
  const [painLevel, setPainLevel] = useState(3);
  const [difficulty, setDifficulty] = useState("moderate");
  const [mood, setMood] = useState("good");
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setError("Not authenticated"); setLoading(false); return; }

      const res = await fetch("/api/patient/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          painLevel,
          // Convert to int for DB
          difficultyLevel: DIFFICULTY_MAP[difficulty] ?? 3,
          // Convert to DB enum value
          mood: MOOD_MAP[mood] ?? "good",
          comments: comments || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit feedback");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => onDone(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting feedback");
      setLoading(false);
    }
  };

  return (
    // Backdrop
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Modal card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 480,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #7c3aed, #2563eb)",
            padding: "24px 28px 20px",
            color: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.25rem" }}>Post-Workout Feedback</div>
          <div style={{ fontSize: "0.88rem", opacity: 0.85, marginTop: 4 }}>
            Help us understand how you felt during this session
          </div>
        </div>

        {/* Body */}
        {success ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#d1fae5", display: "flex", alignItems: "center",
              justifyContent: "center", margin: "0 auto 16px", fontSize: 28,
            }}>✓</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#065f46" }}>Feedback Saved!</div>
            <div style={{ color: "#059669", marginTop: 6 }}>Redirecting to dashboard...</div>
          </div>
        ) : (
          <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 24 }}>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", color: "#b91c1c", fontSize: "0.88rem" }}>
                ⚠ {error}
              </div>
            )}

            {/* Pain level */}
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 10, color: "#374151" }}>
                ❤️ Pain Level: <span style={{ color: "#dc2626", fontWeight: 700 }}>{painLevel}</span>/10
              </div>
              <input
                type="range" min={0} max={10} value={painLevel}
                onChange={(e) => setPainLevel(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#dc2626" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#9ca3af", marginTop: 4 }}>
                <span>No pain</span><span>Maximum pain</span>
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 10, color: "#374151" }}>
                ⚡ Difficulty Level
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {["easy", "moderate", "hard"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, fontWeight: 600,
                      fontSize: "0.88rem", cursor: "pointer", border: "2px solid",
                      borderColor: difficulty === d ? "#ea580c" : "#e5e7eb",
                      background: difficulty === d ? "#fff7ed" : "#fff",
                      color: difficulty === d ? "#9a3412" : "#6b7280",
                      transition: "all 0.15s",
                    }}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 10, color: "#374151" }}>
                😊 Mood
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {[
                  { key: "bad", emoji: "😞" },
                  { key: "okay", emoji: "😐" },
                  { key: "good", emoji: "🙂" },
                  { key: "excellent", emoji: "😄" },
                ].map(({ key, emoji }) => (
                  <button
                    key={key}
                    onClick={() => setMood(key)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, fontWeight: 600,
                      fontSize: "0.82rem", cursor: "pointer", border: "2px solid",
                      borderColor: mood === key ? "#ca8a04" : "#e5e7eb",
                      background: mood === key ? "#fefce8" : "#fff",
                      color: mood === key ? "#713f12" : "#6b7280",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ fontSize: "1.3rem", marginBottom: 2 }}>{emoji}</div>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: 8, color: "#374151" }}>
                💬 Comments <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
              </div>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={500}
                placeholder="Any thoughts about your session..."
                style={{
                  width: "100%", minHeight: 80, padding: "10px 12px",
                  borderRadius: 8, border: "1px solid #d1d5db",
                  fontSize: "0.88rem", resize: "vertical", boxSizing: "border-box",
                  fontFamily: "inherit", outline: "none",
                }}
              />
              <div style={{ fontSize: "0.75rem", color: "#9ca3af", textAlign: "right" }}>{comments.length}/500</div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 8, fontWeight: 700,
                  fontSize: "0.95rem", cursor: loading ? "not-allowed" : "pointer",
                  background: loading ? "#a78bfa" : "#7c3aed", color: "#fff", border: "none",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "Saving..." : "Submit Feedback"}
              </button>
              <button
                onClick={onSkip}
                disabled={loading}
                style={{
                  padding: "12px 20px", borderRadius: 8, fontWeight: 600,
                  fontSize: "0.9rem", cursor: "pointer",
                  background: "#fff", color: "#6b7280",
                  border: "1px solid #e5e7eb",
                }}
              >
                Skip
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

interface UseExerciseSessionProps {
  patientExerciseId: string | null;
  repsTarget: number;
}

interface SessionState {
  sessionId: string | null;
  isSessionActive: boolean;
  error: string | null;
}

const AUTOSAVE_INTERVAL = 10_000;

export function useExerciseSession({ patientExerciseId, repsTarget }: UseExerciseSessionProps) {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    isSessionActive: false,
    error: null,
  });

  const latestReps = useRef<number>(0);
  const latestLabelCounts = useRef<Record<string, Record<string, number>>>({});
  const stateRef = useRef(state);
  const startedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const getToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  useEffect(() => {
    if (!patientExerciseId) return;
    if (startedRef.current) return;
    startedRef.current = true;

    console.log("🚀 Starting session for peId:", patientExerciseId);

    const startSession = async () => {
      try {
        const token = await getToken();
        if (!token) {
          setState((s) => ({ ...s, error: "Not authenticated" }));
          return;
        }

        const res = await fetch("/api/patient/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            patient_exercise_id: patientExerciseId,
            reps_target: repsTarget,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setState((s) => ({ ...s, error: data.error }));
          return;
        }

        setState({ sessionId: data.id, isSessionActive: true, error: null });
        console.log("✅ Session started:", data.id);
      } catch (err) {
        console.error("Failed to start session:", err);
        setState((s) => ({ ...s, error: "Failed to start session" }));
      }
    };

    startSession();
  }, [patientExerciseId]);

  useEffect(() => {
    if (!state.sessionId || !state.isSessionActive) return;
    const interval = setInterval(() => saveProgress(), AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [state.sessionId, state.isSessionActive]);

  const saveProgress = async () => {
    const { sessionId } = stateRef.current;
    if (!sessionId) return;
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`/api/patient/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reps_completed: latestReps.current,
          label_counts: latestLabelCounts.current,
        }),
      });
    } catch (err) {
      console.error("Autosave failed:", err);
    }
  };

  const endSession = useCallback(async () => {
    const { sessionId, isSessionActive } = stateRef.current;
    console.log("endSession called | sessionId:", sessionId, "| isActive:", isSessionActive);
    if (!sessionId || !isSessionActive) return;

    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/patient/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reps_completed: latestReps.current,
          label_counts: latestLabelCounts.current,
        }),
      });
      console.log("endSession PUT status:", res.status);
      if (res.ok) {
        setState((s) => ({ ...s, isSessionActive: false }));
        console.log("✅ Session ended:", sessionId);
      }
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  }, []);

  const updateLive = useCallback((
    reps: number,
    labelCounts: Record<string, Record<string, number>>
  ) => {
    latestReps.current = reps;
    latestLabelCounts.current = labelCounts;
  }, []);

  return { ...state, updateLive, endSession };
}
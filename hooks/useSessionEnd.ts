"use client";

import { useCallback, useRef, useState } from "react";

export type SessionEndState = "idle" | "ending" | "feedback" | "done";

interface UseSessionEndProps {
  endSession: () => Promise<void>;      // from useExerciseSession
  sessionId: string | null;
}

export function useSessionEnd({ endSession, sessionId }: UseSessionEndProps) {
  const [endState, setEndState] = useState<SessionEndState>("idle");
  const calledRef = useRef(false);

  // Call this instead of endSession directly everywhere (button, timer, back link)
  const triggerEnd = useCallback(async () => {
    if (calledRef.current) return;   // prevent double-trigger
    calledRef.current = true;

    setEndState("ending");
    await endSession();
    setEndState("feedback");         // show feedback modal
  }, [endSession]);

  const onFeedbackDone = useCallback(() => {
    setEndState("done");             // Exercise.tsx watches this to redirect
  }, []);

  const onFeedbackSkip = useCallback(() => {
    setEndState("done");
  }, []);

  return { endState, triggerEnd, onFeedbackDone, onFeedbackSkip };
}
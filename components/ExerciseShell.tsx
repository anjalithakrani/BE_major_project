"use client";

/**
 * ExerciseShell
 * -------------
 * Thin wrapper around <Exercise /> that adds:
 *   1. Session-end orchestration (via useSessionEnd)
 *   2. Post-session feedback modal (SessionFeedbackModal)
 *   3. Redirect to /patient/dashboard after feedback
 *
 * Exercise.tsx stays untouched. Swap every exercise page to use
 * <ExerciseShell> instead of <Exercise> directly.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Exercise, { type ExerciseProps } from "@/components/Exercise";
//import { SessionFeedbackModal } from "@/components/sessionFeedbackmodel";
import { useSessionEnd } from "@/hooks/useSessionEnd";
import { useExerciseSession } from "@/hooks/useExerciseSession";
import { useSearchParams } from "next/navigation";

type ExerciseShellProps = Omit<ExerciseProps, "onRequestEnd"> & {
  repsTarget?: number;
};

export default function ExerciseShell(props: ExerciseShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientExerciseId = searchParams.get("peId");

  const { sessionId, isSessionActive, error, updateLive, endSession } =
    useExerciseSession({ patientExerciseId, repsTarget: props.repsTarget ?? 10 });

  const { endState, triggerEnd, onFeedbackDone, onFeedbackSkip } = useSessionEnd({
    endSession,
    sessionId,
  });

  // Redirect once feedback is done or skipped
  useEffect(() => {
    if (endState === "done") {
      router.push("/patient/dashboard");
    }
  }, [endState, router]);

  return (
    <>
      <Exercise
        {...props}
        // Pass the session controls down so Exercise can show the button/status
        sessionId={sessionId}
        isSessionActive={isSessionActive}
        sessionError={error}
        updateLive={updateLive}
        onRequestEnd={triggerEnd}   // Exercise calls this instead of endSession directly
      />

      {/* Feedback modal — shown after session ends, before redirect */}
      {endState === "feedback" && sessionId && (
        <SessionFeedbackModal
          sessionId={sessionId}
          onDone={onFeedbackDone}
          onSkip={onFeedbackSkip}
        />
      )}
    </>
  );
}
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Exercise, { type ExerciseProps } from "@/components/Exercise";
import { SessionFeedbackModal } from "@/components/SessionFeedbackModal";
import { useSessionEnd } from "@/hooks/useSessionEnd";
import { useExerciseSession } from "@/hooks/useExerciseSession";

type ExerciseShellProps = Omit<ExerciseProps, "onRequestEnd"> & {
  repsTarget?: number;
};

function ExerciseShellInner(props: ExerciseShellProps & { patientExerciseId: string | null }) {
  const { patientExerciseId, ...exerciseProps } = props;
  const router = useRouter();

  const { sessionId, isSessionActive, error, updateLive, endSession } =
    useExerciseSession({ patientExerciseId, repsTarget: props.repsTarget ?? 10 });

  const { endState, triggerEnd, onFeedbackDone, onFeedbackSkip } = useSessionEnd({
    endSession,
    sessionId,
  });

  useEffect(() => {
    if (endState === "done") {
      router.push("/patient");
    }
  }, [endState, router]);

  return (
    <>
      <Exercise
        {...exerciseProps}
        sessionId={sessionId}
        isSessionActive={isSessionActive}
        sessionError={error}
        updateLive={updateLive}
        onRequestEnd={triggerEnd}
      />

      {endState === "feedback" && sessionId && (
        <SessionFeedbackModal
          key={sessionId}
          sessionId={sessionId}
          onDone={onFeedbackDone}
          onSkip={onFeedbackSkip}
        />
      )}
    </>
  );
}

export default function ExerciseShell(props: ExerciseShellProps) {
  const searchParams = useSearchParams();
  const patientExerciseId = searchParams.get("peId");

  // key={patientExerciseId} ensures full remount when exercise changes,
  // which resets all hooks and clears stale feedback state
  return (
    <ExerciseShellInner
      key={patientExerciseId ?? "no-id"}
      {...props}
      patientExerciseId={patientExerciseId}
    />
  );
}
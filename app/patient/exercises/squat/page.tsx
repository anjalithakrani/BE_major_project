"use client";

import ExerciseShell from "@/components/ExerciseShell";

const FLASK = process.env.NEXT_PUBLIC_FLASK_URL ?? "http://localhost:5001";

export default function SquatsPage() {
  return (
    <ExerciseShell
      title="Squats"
      statusUrl={`${FLASK}/squat/status`}
      liveUrl={`${FLASK}/squat/live`}
      videoSrc="/videos/squat.mp4"
    />
  );
}
"use client";

import ExerciseShell from "@/components/ExerciseShell";
const FLASK = process.env.NEXT_PUBLIC_FLASK_URL ?? "http://localhost:5001";

export default function LegExtensionPage() {
  return (
    <ExerciseShell
      title="LegExtension"
      statusUrl={`${FLASK}/leg/status`}
      liveUrl={`${FLASK}/leg/live`}
      videoSrc="/videos/leg.mp4"
      
    />
  );
}
"use client";

import ExerciseShell from "@/components/ExerciseShell";

const FLASK = process.env.NEXT_PUBLIC_FLASK_URL ?? "http://localhost:5001";

export default function BicepCurlsPage() {
  return (
    <ExerciseShell
      title="BicepCurls"
      statusUrl={`${FLASK}/bicep/status`}
      liveUrl={`${FLASK}/bicep/live`}
      videoSrc="/videos/bicepcurl.mp4"
    />
  );
}
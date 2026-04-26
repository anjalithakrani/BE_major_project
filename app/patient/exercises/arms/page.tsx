import ExerciseShell from "@/components/ExerciseShell";

const FLASK = process.env.NEXT_PUBLIC_FLASK_URL ?? "http://localhost:5001";

export default function ArmsPage() {
  return (
    <ExerciseShell
      title="ArmRaises"
      statusUrl={`${FLASK}/arms/status`}
      liveUrl={`${FLASK}/arms/live`}
      videoSrc="/videos/arms.mp4"
      videoStyle={{  objectPosition: "center 20%" ,width: "70%"}}
    />
  );
}
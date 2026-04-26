import Exercise from "@/components/Exercise";

const FLASK = process.env.NEXT_PUBLIC_FLASK_URL ?? "http://localhost:5001";

export default function NeckPage() {
  return (
    <Exercise
      title="Neck"
      statusUrl={`${FLASK}/neck/status`}
      liveUrl={`${FLASK}/neck/live`}
      videoSrc="/videos/neck.mp4"
      videoStyle={{  objectPosition: "center 60%" }}
      
    />
  );
}
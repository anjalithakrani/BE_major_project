"use client";

import { useEffect, useRef, useState } from "react";

const useSpeechFeedback = (
  counters: Record<string, number>,
  feedback: Record<string, string>,
  model_feedback: Record<string, string>
) => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const prevCountersRef = useRef<Record<string, number>>({});

  const enableAudio = () => {
    setAudioEnabled(true);
    const utterance = new SpeechSynthesisUtterance("Audio enabled");
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!audioEnabled) return;

    const prevCounters = prevCountersRef.current;
    const messages: string[] = [];

    Object.keys(counters).forEach((key) => {
      const prev = prevCounters[key] ?? 0;
      const curr = counters[key] ?? 0;
      if (curr > prev) {
        const fb = feedback[key];
        const mfb = model_feedback[key];
        if (fb?.trim()) messages.push(fb);
        if (mfb && mfb !== "none" && mfb.trim()) messages.push(mfb);
        if (!fb && !mfb) messages.push(`${curr} reps`);
      }
    });

    if (messages.length > 0) {
      const utterance = new SpeechSynthesisUtterance(messages.join(". "));
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }

    prevCountersRef.current = { ...counters };
  }, [counters, feedback, model_feedback, audioEnabled]);

  return { audioEnabled, enableAudio };
};

export default useSpeechFeedback;
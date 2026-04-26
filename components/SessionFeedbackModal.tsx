'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Heart, AlertCircle, Smile } from 'lucide-react';

interface SessionFeedbackModalProps {
  sessionId: string;
  onDone: () => void;
  onSkip: () => void;
}

const DIFFICULTY_MAP: Record<string, number> = {
  easy: 2,
  moderate: 3,
  hard: 5,
};

const MOOD_MAP: Record<string, string> = {
  bad: "poor",
  okay: "neutral",
  good: "good",
  excellent: "excellent",
};

export function SessionFeedbackModal({ sessionId, onDone, onSkip }: SessionFeedbackModalProps) {
  const [painLevel, setPainLevel] = useState<number>(3);
  const [difficultyLevel, setDifficultyLevel] = useState<string>('moderate');
  const [mood, setMood] = useState<string>('good');
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Not authenticated. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const response = await fetch('/api/patient/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          painLevel,
          difficultyLevel: DIFFICULTY_MAP[difficultyLevel] ?? 3,
          mood: MOOD_MAP[mood] ?? 'good',
          comments: comments || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to submit feedback');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      setTimeout(() => onDone(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error submitting feedback');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        zIndex: 1000, display: "flex", alignItems: "center",
        justifyContent: "center", padding: 24,
      }}>
        <Card className="border-green-200 bg-green-50 w-full max-w-lg">
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="font-semibold text-green-900 text-lg">Feedback Recorded</h3>
            <p className="text-green-700 mt-2">Your feedback has been saved successfully</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 1000, display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24,
    }}>
      <Card className="border-0 shadow-lg w-full max-w-lg">
        <CardHeader className="bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-t-lg">
          <CardTitle>Post-Workout Feedback</CardTitle>
          <CardDescription className="text-purple-100">
            Help us understand how you felt during this session
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Pain Level */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-3 flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-500" />
                Pain Level
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={painLevel}
                  onChange={(e) => setPainLevel(Number(e.target.value))}
                  className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-3xl font-bold text-red-600 w-12 text-right">{painLevel}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>No pain</span>
                <span>Maximum pain</span>
              </div>
            </div>

            {/* Difficulty Level */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Difficulty Level
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['easy', 'moderate', 'hard'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficultyLevel(level)}
                    className={`p-3 rounded-lg font-semibold transition-all border-2 ${
                      difficultyLevel === level
                        ? 'border-orange-600 bg-orange-100 text-orange-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-3 flex items-center gap-2">
                <Smile className="w-4 h-4 text-yellow-500" />
                Mood
              </label>
              <div className="grid grid-cols-4 gap-3">
                {['bad', 'okay', 'good', 'excellent'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`p-3 rounded-lg font-semibold transition-all border-2 ${
                      mood === m
                        ? 'border-yellow-600 bg-yellow-100 text-yellow-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <label htmlFor="comments" className="text-sm font-semibold text-gray-700 block mb-2">
                Additional Comments (Optional)
              </label>
              <Textarea
                id="comments"
                placeholder="Any additional thoughts about your session..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={500}
                className="min-h-24 rounded-lg border-gray-300"
              />
              <p className="text-xs text-gray-500 mt-1">{comments.length}/500</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                {loading ? 'Saving...' : 'Submit Feedback'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSkip}
                disabled={loading}
              >
                Skip
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
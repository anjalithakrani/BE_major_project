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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <Card className="w-full max-w-md border-0 shadow-xl rounded-2xl bg-green-50">
          <CardContent className="pt-8 pb-6 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="font-semibold text-green-900 text-lg">Feedback Recorded</h3>
            <p className="text-green-700 mt-2 text-sm">
              Your feedback has been saved successfully
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <Card className="w-full max-w-lg border-0 shadow-2xl rounded-2xl overflow-hidden">
        
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-5">
          <CardTitle className="text-lg font-semibold">
            Post-Workout Feedback
          </CardTitle>
          <CardDescription className="text-purple-100 text-sm">
            Help us understand how you felt during this session
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex gap-2 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Pain Level */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
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
                  className="flex-1 accent-red-500 cursor-pointer"
                />
                <span className="text-xl font-semibold text-red-600 w-10 text-right">
                  {painLevel}
                </span>
              </div>

              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>No pain</span>
                <span>Max</span>
              </div>
            </div>

            {/* Difficulty */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                Difficulty Level
              </label>

              <div className="grid grid-cols-3 gap-3">
                {['easy', 'moderate', 'hard'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficultyLevel(level)}
                    className={`py-2 rounded-lg text-sm font-medium transition-all border
                      ${
                        difficultyLevel === level
                          ? 'bg-orange-500 text-white border-orange-500 shadow'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Mood */}
            <div>
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                <Smile className="w-4 h-4 text-yellow-500" />
                Mood
              </label>

              <div className="grid grid-cols-4 gap-3">
                {['bad', 'okay', 'good', 'excellent'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`py-2 rounded-lg text-sm font-medium transition-all border
                      ${
                        mood === m
                          ? 'bg-yellow-400 text-white border-yellow-400 shadow'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Comments */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Additional Comments
              </label>
              <Textarea
                placeholder="Any additional thoughts..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                maxLength={500}
                className="rounded-lg border-gray-300 focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {comments.length}/500
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium"
              >
                {loading ? 'Saving...' : 'Submit Feedback'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={onSkip}
                disabled={loading}
                className="hover:bg-gray-100"
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
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { TrendingUp, Target, Zap, Clock } from 'lucide-react';

interface SessionFeedback {
  pain_level: number | null;
  difficulty_level: number | null;
  mood: string | null;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
  reps_completed: number;
  reps_target: number;
  completed: boolean;
  label_counts: Record<string, number> | null;
  patient_exercise?: {
    reps_target: number;
    sets_target: number;
    exercise?: {
      name: string;
      body_part: string;
    };
  };
  session_feedback?: SessionFeedback[];
}

interface Stats {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  averageAccuracy: number;
  thisWeekSessions: number;
}

export default function PatientDashboardPage() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    completedSessions: 0,
    completionRate: 0,
    averageAccuracy: 0,
    thisWeekSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const computeStats = (data: Session[]): Stats => {
    const totalSessions = data.length;
    const completedSessions = data.filter(s => s.completed).length;
    const completionRate = totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0;

    let totalAccuracy = 0;
    let accuracyCount = 0;
    data.forEach(session => {
      const target = session.patient_exercise?.reps_target || session.reps_target;
      if (target && target > 0) {
        const accuracy = (session.reps_completed / target) * 100;
        totalAccuracy += Math.min(accuracy, 100);
        accuracyCount++;
      }
    });
    const averageAccuracy = accuracyCount > 0
      ? Math.round(totalAccuracy / accuracyCount)
      : 0;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeekSessions = data.filter(
      s => new Date(s.start_time) >= weekAgo
    ).length;

    return { totalSessions, completedSessions, completionRate, averageAccuracy, thisWeekSessions };
  };

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const { data: { session: authSession } } = await supabase.auth.getSession();
      if (!authSession?.user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      const userId = authSession.user.id;

      // Step 1: fetch sessions without session_feedback join (no FK in schema)
      const { data, error: dbError } = await supabase
        .from('sessions')
        .select(`
          id,
          start_time,
          end_time,
          duration_seconds,
          reps_completed,
          reps_target,
          completed,
          label_counts,
          patient_exercise:patient_exercise_id (
            reps_target,
            sets_target,
            exercise:exercise_id (
              name,
              body_part
            )
          )
        `)
        .eq('patient_id', userId)
        .order('start_time', { ascending: false });

      if (dbError) throw dbError;

      // Step 2: fetch feedback separately
      const { data: feedbackData } = await supabase
        .from('session_feedback')
        .select('session_id, pain_level, difficulty_level, mood')
        .eq('patient_id', userId);

      // Step 3: merge feedback into sessions by session_id
      const feedbackMap = new Map(
        (feedbackData || []).map(f => [f.session_id, f])
      );

      const sessionData = (data || []).map(session => ({
        ...session,
        session_feedback: feedbackMap.get(session.id)
          ? [feedbackMap.get(session.id) as SessionFeedback]
          : [],
      })) as Session[];

      setSessions(sessionData);
      setStats(computeStats(sessionData));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (user) fetchSessions();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `patient_id=eq.${user.id}`,
      }, () => fetchSessions())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'session_feedback',
        filter: `patient_id=eq.${user.id}`,
      }, () => fetchSessions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSessions]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const getMoodEmoji = (mood: string | null) => {
    const map: Record<string, string> = {
      excellent: '😄', good: '🙂', neutral: '😐', poor: '😕', terrible: '😞',
    };
    return mood ? map[mood] ?? '' : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-3xl font-bold text-gray-900">
          Welcome back, {profile?.full_name}
        </h2>
        <p className="text-gray-600 mt-2">Track your therapy progress and stay on target</p>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Total Sessions</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalSessions}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Completed</p>
                <p className="text-3xl font-bold text-gray-900">{stats.completedSessions}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Avg Accuracy</p>
                <p className="text-3xl font-bold text-gray-900">{stats.averageAccuracy}%</p>
              </div>
              <div className="p-3 bg-teal-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">This Week</p>
                <p className="text-3xl font-bold text-gray-900">{stats.thisWeekSessions}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900">Recent Sessions</h3>
          <Link href="/patient/exercises">
            <Button className="bg-blue-600 hover:bg-blue-700">Start New Session</Button>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {sessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-12 pb-12 text-center">
              <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No sessions yet</p>
              <p className="text-gray-500 mt-1">
                Complete your first exercise session to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.slice(0, 5).map((session) => {
              const feedback = session.session_feedback?.[0];
              return (
                <Card key={session.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">
                          {session.patient_exercise?.exercise?.name || 'Exercise'}
                          {session.patient_exercise?.exercise?.body_part && (
                            <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                              {session.patient_exercise.exercise.body_part}
                            </span>
                          )}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(session.start_time).toLocaleDateString()} at{' '}
                          {new Date(session.start_time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {session.duration_seconds && (
                            <span className="ml-2 text-gray-400">
                              · {formatDuration(session.duration_seconds)}
                            </span>
                          )}
                        </p>
                        {feedback && (
                          <p className="text-xs text-gray-400 mt-1">
                            {getMoodEmoji(feedback.mood)}
                            {feedback.pain_level !== null && (
                              <span className="ml-2">Pain: {feedback.pain_level}/10</span>
                            )}
                            {feedback.difficulty_level !== null && (
                              <span className="ml-2">Difficulty: {feedback.difficulty_level}/5</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {session.reps_completed} /{' '}
                          {session.patient_exercise?.reps_target ?? session.reps_target} reps
                          {session.patient_exercise?.sets_target && (
                            <span className="text-gray-500 font-normal">
                              {' '}× {session.patient_exercise.sets_target} sets
                            </span>
                          )}
                        </p>
                        <p className={`text-sm font-medium mt-1 ${
                          session.completed ? 'text-green-600' : 'text-orange-500'
                        }`}>
                          {session.completed ? '✓ Completed' : '⏳ In Progress'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
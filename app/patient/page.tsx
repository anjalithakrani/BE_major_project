'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { TrendingUp, Target, Zap, Clock } from 'lucide-react';

interface Session {
  id: string;
  start_time: string;
  completed: boolean;
  reps_completed: number;
  sets_completed: number;
  patient_exercise?: {
    exercise?: {
      name: string;
    };
  };
}

export default function PatientDashboardPage() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/patient/progress');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load progress');
      }

      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const completedSessions = sessions.filter((s) => s.completed).length;
  const completionRate = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0;
  const thisWeekSessions = sessions.filter((s) => {
    const sessionDate = new Date(s.start_time);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return sessionDate >= weekAgo;
  }).length;

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-3xl font-bold text-gray-900">Welcome back, {profile?.full_name}</h2>
        <p className="text-gray-600 mt-2">Track your therapy progress and stay on target</p>
      </div>

      {/* Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Total Sessions</p>
                <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
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
                <p className="text-3xl font-bold text-gray-900">{completedSessions}</p>
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
                <p className="text-sm text-gray-600 mb-2">Completion Rate</p>
                <p className="text-3xl font-bold text-gray-900">{completionRate}%</p>
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
                <p className="text-3xl font-bold text-gray-900">{thisWeekSessions}</p>
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
              <p className="text-gray-500 mt-1">Complete your first exercise session to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.slice(0, 5).map((session) => (
              <Card key={session.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">
                        {(session as any).patient_exercise?.exercise?.name || 'Exercise'}
                      </h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {new Date(session.start_time).toLocaleDateString()} at{' '}
                        {new Date(session.start_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {session.reps_completed} reps × {session.sets_completed} sets
                      </p>
                      <p
                        className={`text-sm font-medium mt-1 ${
                          session.completed ? 'text-green-600' : 'text-gray-500'
                        }`}
                      >
                        {session.completed ? '✓ Completed' : 'In Progress'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

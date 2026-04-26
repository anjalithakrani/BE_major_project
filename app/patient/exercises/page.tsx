'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Activity, Target, Calendar } from 'lucide-react';

interface PatientExercise {
  id: string;
  reps_target: number;
  sets_target: number;
  angle_threshold: number;
  confidence_threshold: number;
  frequency_per_week: number;
  assigned_date: string;
  exercise: {
    id: string;
    name: string;
    description: string;
    body_part: string;
    instructions: string;
    video_url: string | null;
  };
}

const EXERCISE_ROUTES: Record<string, string> = {
  BicepCurls: '/patient/exercises/bicep',
  Squats: '/patient/exercises/squat',
  LegExtension: '/patient/exercises/leg',
  Neck: '/patient/exercises/neck',
};

const getExerciseRoute = (name: string, peId: string): string => {
  const base = EXERCISE_ROUTES[name];
  if (!base) return '#';
  return `${base}?peId=${peId}`;
};

export default function PatientExercisesPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<PatientExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) fetchExercises();
  }, [user]);

  const fetchExercises = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session found');

      const res = await fetch('/api/patient/exercises', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch exercises');

      setExercises(data);
    } catch (err) {
      setError('Failed to load exercises');
      console.error(err);
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

  return (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-3xl font-bold text-gray-900">My Exercises</h2>
        <p className="text-gray-600 mt-2">Your personalized therapy program</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {exercises.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No exercises assigned yet</p>
            <p className="text-gray-500 mt-1">
              Contact your doctor to receive a personalized therapy program
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exercises.map((pe) => {
            const route = getExerciseRoute(pe.exercise.name, pe.id);
            const isSupported = route !== '#';

            return (
              <Card
                key={pe.id}
                className="border-0 shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl text-gray-900">
                        {pe.exercise.name}
                      </CardTitle>
                      <CardDescription className="text-blue-600 capitalize mt-1">
                        {pe.exercise.body_part}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 flex-1">
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {pe.exercise.description}
                  </p>

                  <div className="space-y-3 py-3 border-y border-gray-200">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      <div>
                        <p className="text-xs text-gray-500">Target</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {pe.sets_target} sets × {pe.reps_target} reps
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <div>
                        <p className="text-xs text-gray-500">Frequency</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {pe.frequency_per_week}× per week
                        </p>
                      </div>
                    </div>
                  </div>

                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-blue-600 hover:text-blue-700 py-2">
                      View instructions
                    </summary>
                    <p className="mt-3 text-gray-600 text-xs leading-relaxed">
                      {pe.exercise.instructions}
                    </p>
                  </details>

                  {isSupported ? (
                    <Link href={route}>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700">
                        Start Workout
                      </Button>
                    </Link>
                  ) : (
                    <Button disabled className="w-full">
                      Coming Soon
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
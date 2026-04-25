'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import Link from 'next/link';

interface Patient {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
}

interface Session {
  id: string;
  start_time: string;
  end_time?: string;
  completed: boolean;
  reps_completed: number;
  sets_completed: number;
  patient_exercise?: {
    exercise?: {
      name: string;
    };
  };
}

export default function DoctorPatientDetailsPage() {
  const params = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPatientData();
  }, [params.id]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);

      // Get patient profile
      const { data: patientData, error: pError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, date_of_birth')
        .eq('id', params.id)
        .single();

      if (pError) throw pError;
      setPatient(patientData);

      // Get patient sessions
      const { data: sessionsData, error: sError } = await supabase
        .from('sessions')
        .select(
          `
          id, start_time, end_time, completed, reps_completed, sets_completed,
          patient_exercise!inner(
            exercise(name)
          )
        `
        )
        .eq('patient_id', params.id)
        .order('start_time', { ascending: false });

      if (sError) throw sError;
      setSessions(sessionsData || []);
    } catch (err) {
      setError('Failed to load patient data');
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

  if (!patient) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        Patient not found
      </div>
    );
  }

  const completedSessions = sessions.filter((s) => s.completed).length;
  const completionRate =
    sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{patient.full_name}</h2>
        <p className="text-gray-500 mt-1">{patient.email}</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedSessions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Session History</h3>
          <Link href={`/doctor/patient/${params.id}/exercises`}>
            <Button>Assign Exercises</Button>
          </Link>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">No sessions recorded yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">
                        {(session as any).patient_exercise?.exercise?.name || 'Exercise'}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {new Date(session.start_time).toLocaleDateString()} at{' '}
                        {new Date(session.start_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {session.reps_completed} reps {session.sets_completed} sets
                      </p>
                      <p
                        className={`text-sm ${
                          session.completed ? 'text-green-600' : 'text-amber-600'
                        }`}
                      >
                        {session.completed ? 'Completed' : 'In Progress'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Link href={`/doctor/patient/${params.id}/report`}>
        <Button className="w-full">Generate Report</Button>
      </Link>
    </div>
  );
}

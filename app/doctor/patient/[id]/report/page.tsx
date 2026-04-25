'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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
    reps_target: number;
    sets_target: number;
    exercise?: {
      name: string;
      body_part: string;
    };
  };
}

export default function ReportPage() {
  const params = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, [params.id]);

  const fetchReportData = async () => {
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

      // Get patient sessions with exercise details
      const { data: sessionsData, error: sError } = await supabase
        .from('sessions')
        .select(
          `
          id, start_time, end_time, completed, reps_completed, sets_completed,
          patient_exercise!inner(
            reps_target, sets_target,
            exercise(name, body_part)
          )
        `
        )
        .eq('patient_id', params.id)
        .order('start_time', { ascending: false });

      if (sError) throw sError;
      setSessions(sessionsData || []);
    } catch (err) {
      setError('Failed to load report data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    try {
      setGeneratingPDF(true);
      const element = document.getElementById('report-content');

      if (!element) {
        setError('Report content not found');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let yPosition = 10;

      pdf.addImage(imgData, 'PNG', 10, yPosition, imgWidth, imgHeight);

      let totalHeight = imgHeight + 20;
      while (totalHeight > pageHeight) {
        pdf.addPage();
        totalHeight -= pageHeight;
      }

      pdf.save(`${patient?.full_name}-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      setError('Failed to generate PDF');
      console.error(err);
    } finally {
      setGeneratingPDF(false);
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

  const exerciseStats = sessions.reduce(
    (acc: any, session) => {
      const exerciseName = (session as any).patient_exercise?.exercise?.name || 'Unknown';
      if (!acc[exerciseName]) {
        acc[exerciseName] = { completed: 0, total: 0, totalReps: 0 };
      }
      acc[exerciseName].total += 1;
      acc[exerciseName].totalReps += session.reps_completed;
      if (session.completed) {
        acc[exerciseName].completed += 1;
      }
      return acc;
    },
    {}
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Therapy Progress Report</h2>
        <p className="text-gray-500 mt-1">Patient: {patient.full_name}</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={generatePDF} disabled={generatingPDF}>
          {generatingPDF ? 'Generating PDF...' : 'Download PDF Report'}
        </Button>
        <Link href={`/doctor/patient/${params.id}`}>
          <Button variant="outline">Back to Patient</Button>
        </Link>
      </div>

      <div id="report-content" className="space-y-6 bg-white p-8">
        <div>
          <h3 className="text-2xl font-bold mb-4">Patient Information</h3>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Name</p>
              <p className="text-lg font-semibold">{patient.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Email</p>
              <p className="text-lg">{patient.email}</p>
            </div>
            {patient.phone && (
              <div>
                <p className="text-sm font-medium text-gray-600">Phone</p>
                <p className="text-lg">{patient.phone}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Report Date</p>
              <p className="text-lg">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-2xl font-bold mb-4">Progress Summary</h3>
          <div className="grid grid-cols-4 gap-4">
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total Reps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sessions.reduce((sum, s) => sum + s.reps_completed, 0)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-2xl font-bold mb-4">Exercise Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(exerciseStats).map(([exerciseName, stats]: any) => (
              <div key={exerciseName} className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">{exerciseName}</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Sessions</p>
                    <p className="font-semibold">
                      {stats.completed}/{stats.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Success Rate</p>
                    <p className="font-semibold">
                      {Math.round((stats.completed / stats.total) * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Reps</p>
                    <p className="font-semibold">{stats.totalReps}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-2xl font-bold mb-4">Recent Sessions</h3>
          <div className="space-y-2">
            {sessions.slice(0, 10).map((session) => (
              <div key={session.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">
                    {(session as any).patient_exercise?.exercise?.name}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(session.start_time).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {session.reps_completed}/{(session as any).patient_exercise?.reps_target} reps
                  </p>
                  <p className={`text-sm ${session.completed ? 'text-green-600' : 'text-gray-600'}`}>
                    {session.completed ? 'Completed' : 'Partial'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-6">
          <p className="text-sm text-gray-600 text-center">
            Generated on {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

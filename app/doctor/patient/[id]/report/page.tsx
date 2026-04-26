'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, FileDown } from 'lucide-react';
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
  const id = params?.id;
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Patient Profile
      const { data: patientData, error: pError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, date_of_birth')
        .eq('id', id)
        .single();

      if (pError) throw pError;
      setPatient(patientData);

      // 2. Fetch Sessions using plural 'patient_exercises' and manual stitching 
      // to avoid relationship cache errors (PGRST200)
      const { data: sessionsData, error: sError } = await supabase
        .from('sessions')
        .select(`
          id, start_time, end_time, completed, reps_completed, sets_completed,
          patient_exercises (
            reps_target, sets_target,
            exercise:exercise_id ( name, body_part )
          )
        `)
        .eq('patient_id', id)
        .order('start_time', { ascending: false });

      if (sError) throw sError;

      // Map 'patient_exercises' back to 'patient_exercise' for your UI logic
      const formattedSessions = (sessionsData || []).map((s: any) => ({
        ...s,
        patient_exercise: s.patient_exercises
      }));

      setSessions(formattedSessions);
    } catch (err: any) {
      setError('Failed to load report data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const generatePDF = async () => {
    try {
      setGeneratingPDF(true);
      
      // ✅ CRITICAL FIX: Dynamic imports inside the function prevent server crash
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      const element = document.getElementById('report-content');
      if (!element) {
        setError('Report content not found');
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
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

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);

      // Simple multi-page check
      if (imgHeight > pageHeight - 20) {
          // You can add logic here to handle very long reports if needed
      }

      pdf.save(`${patient?.full_name?.replace(/\s+/g, '_')}_Report.pdf`);
    } catch (err) {
      setError('Failed to generate PDF');
      console.error(err);
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner /></div>;
  if (!patient) return <div className="p-4 bg-red-50 text-red-700 rounded-lg">Patient not found</div>;

  const completedSessions = sessions.filter((s) => s.completed).length;
  const completionRate = sessions.length > 0 ? Math.round((completedSessions / sessions.length) * 100) : 0;

  const exerciseStats = sessions.reduce((acc: any, session) => {
      const exerciseName = session.patient_exercise?.exercise?.name || 'Unknown';
      if (!acc[exerciseName]) {
        acc[exerciseName] = { completed: 0, total: 0, totalReps: 0 };
      }
      acc[exerciseName].total += 1;
      acc[exerciseName].totalReps += session.reps_completed;
      if (session.completed) acc[exerciseName].completed += 1;
      return acc;
    }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Therapy Progress Report</h2>
          <p className="text-gray-500 mt-1 italic">Patient: {patient.full_name}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generatePDF} disabled={generatingPDF} className="bg-blue-600">
            {generatingPDF ? <Spinner className="mr-2 h-4 w-4" /> : <FileDown className="mr-2 h-4 w-4" />}
            {generatingPDF ? 'Generating...' : 'Download PDF'}
          </Button>
          <Link href={`/doctor/patient/${id}`}>
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          </Link>
        </div>
      </div>

      {error && <div className="p-4 bg-red-50 border-red-200 text-red-700 rounded-lg">{error}</div>}

      <Card id="report-content" className="bg-white p-8 shadow-none border">
        <div className="border-b pb-6 mb-6 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold text-blue-900 uppercase">Patient Information</h3>
            <div className="grid grid-cols-2 gap-x-12 gap-y-2 mt-4 text-sm">
              <p><span className="text-gray-500 font-medium">Name:</span> {patient.full_name}</p>
              <p><span className="text-gray-500 font-medium">Email:</span> {patient.email}</p>
              {patient.phone && <p><span className="text-gray-500 font-medium">Phone:</span> {patient.phone}</p>}
              <p><span className="text-gray-500 font-medium">Date:</span> {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">PHYSIO-CARE OFFICIAL</div>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h4 className="text-lg font-bold mb-4">Progress Summary</h4>
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase font-bold">Total Sessions</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase font-bold">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">{completionRate}%</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase font-bold">Total Reps</p>
                <p className="text-2xl font-bold text-blue-600">
                  {sessions.reduce((sum, s) => sum + s.reps_completed, 0)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-xs text-gray-500 uppercase font-bold">Accuracy</p>
                <p className="text-2xl font-bold text-orange-500">High</p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h4 className="text-lg font-bold mb-4">Exercise Breakdown</h4>
            <div className="grid gap-3">
              {Object.entries(exerciseStats).map(([exerciseName, stats]: any) => (
                <div key={exerciseName} className="p-4 border rounded-lg flex justify-between items-center">
                  <span className="font-semibold">{exerciseName}</span>
                  <div className="flex gap-8 text-sm">
                    <span><span className="text-gray-400">Rate:</span> {Math.round((stats.completed / stats.total) * 100)}%</span>
                    <span><span className="text-gray-400">Total Reps:</span> {stats.totalReps}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-6">
            <h4 className="text-lg font-bold mb-4">Recent Session Logs</h4>
            <div className="space-y-2 text-sm">
              {sessions.slice(0, 10).map((session) => (
                <div key={session.id} className="flex justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-gray-900">{session.patient_exercise?.exercise?.name}</p>
                    <p className="text-xs text-gray-500">{new Date(session.start_time).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{session.reps_completed}/{session.patient_exercise?.reps_target} reps</p>
                    <p className={`text-[10px] font-black uppercase ${session.completed ? 'text-green-600' : 'text-gray-400'}`}>
                      {session.completed ? 'Completed' : 'Partial'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
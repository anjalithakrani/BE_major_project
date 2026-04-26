'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeft, Clock, Target, TrendingUp, Zap, PlusCircle } from 'lucide-react';

// This is the CRITICAL FIX: It forces the PDF logic to be browser-only
const PatientReportAction = dynamic(
  () => import('./PatientReportAction'),
  { ssr: false, loading: () => <Button variant="outline" disabled>Loading...</Button> }
);

export default function PatientDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [patient, setPatient] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, rate: 0, accuracy: 11, weekly: 0 });

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single();
      setPatient(profile);

      const { data: rawSessions } = await supabase.from('sessions').select('*').eq('patient_id', id).order('start_time', { ascending: false });
      const { data: pExData } = await supabase.from('patient_exercises').select('id, exercise_id').eq('patient_id', id);
      const { data: globalExData } = await supabase.from('exercises').select('id, name');

      const exMap = new Map(globalExData?.map(e => [e.id, e.name]));
      const linkMap = new Map(pExData?.map(link => [link.id, link.exercise_id]));

      const stitched = (rawSessions || []).map(s => ({
        ...s,
        exercise_name: exMap.get(linkMap.get(s.patient_exercise_id)) || 'Exercise'
      }));

      const total = stitched.length;
      const completed = stitched.filter(s => s.completed).length;

      setStats({
        total,
        rate: total > 0 ? Math.round((completed / total) * 100) : 0,
        accuracy: 11,
        weekly: total
      });
      setSessions(stitched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (user && id) fetchData(); }, [user, id, fetchData]);

  if (loading) return <div className="flex justify-center p-20"><Spinner /></div>;

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/doctor">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-gray-100">
              <ArrowLeft />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{patient?.full_name}</h2>
            <p className="text-gray-500">{patient?.email}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {/* Using the dynamically imported component */}
          <PatientReportAction
  patientId={patient.id}
  patientName={patient.full_name}
  stats={stats}
/>
          <Link href={`/doctor/patient/${id}/exercises`}>
            <Button className="bg-blue-600 hover:bg-blue-700">Assign Exercise</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard title="Sessions" value={stats.total} icon={<Clock className="text-blue-500" />} />
        <StatCard title="Completion" value={`${stats.rate}%`} icon={<Target className="text-green-500" />} />
        <StatCard title="Avg Accuracy" value={`${stats.accuracy}%`} icon={<TrendingUp className="text-teal-500" />} />
        <StatCard title="This Week" value={stats.weekly} icon={<Zap className="text-orange-500" />} />
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Activity History</h3>
        <div className="grid gap-3">
          {sessions.map(s => (
            <Card key={s.id} className="border-0 shadow-sm border-l-4 border-l-blue-600">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{s.exercise_name}</p>
                  <p className="text-xs text-gray-500">{new Date(s.start_time).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{s.reps_completed} / {s.reps_target} reps</p>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${s.completed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {s.completed ? 'Success' : 'Incomplete'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: any; icon: any }) {
  return (
    <Card className="p-6 flex justify-between items-start bg-white shadow-sm border-0">
      <div>
        <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">{title}</p>
        <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
      </div>
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
    </Card>
  );
}
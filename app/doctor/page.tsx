'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Users, Plus, TrendingUp } from 'lucide-react';

interface PatientData {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
}

interface PatientWithStats extends PatientData {
  sessionCount?: number;
  completionRate?: number;
}

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [addingPatient, setAddingPatient] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (user) {
      fetchPatients();
    }
  }, [user]);

  // ✅ Get token helper (clean)
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      const response = await fetch('/api/doctor/patients', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch patients');
      }

      const patientsWithStats: PatientWithStats[] = [];

      for (const relation of data) {
        const patient = relation.profiles;

        const { data: sessions } = await supabase
          .from('sessions')
          .select('completed')
          .eq('patient_id', relation.patient_id);

        const sessionCount = sessions?.length || 0;
        const completedCount = sessions?.filter(s => s.completed).length || 0;
        const completionRate =
          sessionCount > 0 ? (completedCount / sessionCount) * 100 : 0;

        patientsWithStats.push({
          id: patient.id,
          email: patient.email,
          full_name: patient.full_name,
          sessionCount,
          completionRate: Math.round(completionRate),
        });
      }

      setPatients(patientsWithStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchEmail) return;

    setAddingPatient(true);
    setAddError('');

    try {
      const token = await getToken(); // ✅ get token

      const response = await fetch('/api/doctor/patients/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // ✅ FIXED HERE
        },
        body: JSON.stringify({ patientEmail: searchEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        setAddError(data.error || 'Failed to add patient');
        setAddingPatient(false);
        return;
      }

      setSearchEmail('');
      await fetchPatients(); // refresh list
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Error adding patient');
    } finally {
      setAddingPatient(false);
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
        <h2 className="text-3xl font-bold text-gray-900">My Patients</h2>
        <p className="text-gray-600 mt-2">
          Monitor and manage your patients' therapy progress
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Add Patient */}
      <Card className="border-0 shadow-sm bg-blue-50 border-l-4 border-blue-600">
        <CardContent className="pt-6">
          <form onSubmit={handleAddPatient} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Add Patient by Email
              </label>
              <Input
                type="email"
                placeholder="patient@example.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                disabled={addingPatient}
              />
              {addError && (
                <p className="text-red-600 text-sm mt-2">{addError}</p>
              )}
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={addingPatient || !searchEmail}
                className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto gap-2"
              >
                <Plus className="w-4 h-4" />
                {addingPatient ? 'Adding...' : 'Add Patient'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Patients */}
      {patients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No patients assigned yet</p>
            <p className="text-gray-500 mt-1">
              Add your first patient using the email above
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {patients.map((patient) => (
            <Card key={patient.id} className="shadow-sm flex flex-col">
              <CardContent className="pt-6 flex-1">
                <h3 className="text-lg font-bold">{patient.full_name}</h3>
                <p className="text-sm text-gray-500">{patient.email}</p>

                <div className="py-4 border-y mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Sessions</span>
                    <span>{patient.sessionCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completion</span>
                    <span>{patient.completionRate || 0}%</span>
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <Link href={`/doctor/patient/${patient.id}`}>
                    <Button variant="outline" className="w-full">
                      View Progress
                    </Button>
                  </Link>

                  <Link href={`/doctor/patient/${patient.id}/exercises`}>
                    <Button className="w-full bg-blue-600">
                      Assign Exercise
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
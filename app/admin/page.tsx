'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/lib/supabase';

interface Patient {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  date_of_birth?: string;
  created_at: string;
}

interface Doctor {
  id: string;
  email: string;
  full_name: string;
  clinic_name?: string;
}

export default function AdminPatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  // Assign doctor modal state
  const [assigningPatient, setAssigningPatient] = useState<Patient | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    phone: '',
    dateOfBirth: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      fetchPatients();
      fetchDoctors();
    }
  }, [user]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch('/api/admin/patients', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch patients');
      const data = await response.json();
      setPatients(data.patients || []);
    } catch (err) {
      setError('Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/doctors', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch doctors');
      const data = await response.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error('Failed to load doctors', err);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create patient');
      }
      setSuccess('Patient created successfully!');
      setFormData({ email: '', fullName: '', phone: '', dateOfBirth: '' });
      setShowNewPatientForm(false);
      await fetchPatients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignDoctor = async () => {
    if (!assigningPatient || !selectedDoctorId) return;
    setError('');
    setSuccess('');
    setAssigning(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/admin/assign-doctor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          patientId: assigningPatient.id,
          notes: assignNotes || null,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to assign doctor');

      setSuccess(`Doctor assigned to ${assigningPatient.full_name} successfully!`);
      setAssigningPatient(null);
      setSelectedDoctorId('');
      setAssignNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign doctor');
    } finally {
      setAssigning(false);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Patients</h2>
          <p className="text-gray-500 mt-1">Manage patient accounts and assignments</p>
        </div>
        <Button onClick={() => setShowNewPatientForm(!showNewPatientForm)}>
          {showNewPatientForm ? 'Cancel' : 'Add Patient'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {showNewPatientForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Patient</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreatePatient} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name</label>
                  <Input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date of Birth</label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Patient'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Assign Doctor Modal */}
      {assigningPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Assign Doctor</CardTitle>
              <p className="text-sm text-gray-500">
                Assigning to: <span className="font-medium">{assigningPatient.full_name}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Select Doctor</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                >
                  <option value="">-- Choose a doctor --</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.full_name} {doctor.clinic_name ? `(${doctor.clinic_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes (optional)</label>
                <Input
                  type="text"
                  placeholder="Any notes about this assignment..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  disabled={assigning}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleAssignDoctor}
                  disabled={assigning || !selectedDoctorId}
                  className="flex-1"
                >
                  {assigning ? 'Assigning...' : 'Assign Doctor'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAssigningPatient(null);
                    setSelectedDoctorId('');
                    setAssignNotes('');
                  }}
                  disabled={assigning}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4">
        {patients.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">No patients yet</p>
            </CardContent>
          </Card>
        ) : (
          patients.map((patient) => (
            <Card key={patient.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{patient.full_name}</h3>
                    <p className="text-sm text-gray-500">{patient.email}</p>
                    {patient.phone && (
                      <p className="text-sm text-gray-500">{patient.phone}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssigningPatient(patient)}
                  >
                    Assign Doctor
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
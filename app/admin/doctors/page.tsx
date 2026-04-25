'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { supabase } from '@/lib/supabase';

interface Doctor {
  id: string;
  email: string;
  full_name: string;
  license_number?: string;
  clinic_name?: string;
  phone?: string;
  created_at: string;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDoctorForm, setShowNewDoctorForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    licenseNumber: '',
    clinicName: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/doctors', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });
      const data = await response.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      setError('Failed to load doctors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.fullName,
          licenseNumber: formData.licenseNumber,
          clinicName: formData.clinicName,
          phone: formData.phone,
          password: 'Doctor1234!',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create doctor');
      }

      setSuccess('Doctor account created successfully! Default password: Doctor1234!');
      setFormData({
        email: '',
        fullName: '',
        licenseNumber: '',
        clinicName: '',
        phone: '',
      });
      setShowNewDoctorForm(false);
      await fetchDoctors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create doctor');
    } finally {
      setSubmitting(false);
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
          <h2 className="text-3xl font-bold tracking-tight">Doctors</h2>
          <p className="text-gray-500 mt-1">Manage physiotherapist accounts</p>
        </div>
        <Button onClick={() => setShowNewDoctorForm(!showNewDoctorForm)}>
          {showNewDoctorForm ? 'Cancel' : 'Add Doctor'}
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

      {showNewDoctorForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Doctor Account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateDoctor} className="space-y-4">
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
                  <label className="block text-sm font-medium mb-1">License Number</label>
                  <Input
                    type="text"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Clinic Name</label>
                  <Input
                    type="text"
                    value={formData.clinicName}
                    onChange={(e) => setFormData({ ...formData, clinicName: e.target.value })}
                    disabled={submitting}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={submitting}
                  />
                </div>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Doctor Account'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {doctors.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">No doctors yet</p>
            </CardContent>
          </Card>
        ) : (
          doctors.map((doctor) => (
            <Card key={doctor.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{doctor.full_name}</h3>
                    <p className="text-sm text-gray-500">{doctor.email}</p>
                    {doctor.license_number && (
                      <p className="text-sm text-gray-500">License: {doctor.license_number}</p>
                    )}
                    {doctor.clinic_name && (
                      <p className="text-sm text-gray-500">{doctor.clinic_name}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    Edit
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
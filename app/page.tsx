'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { LandingPage } from '@/components/landing-page';

export default function Home() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // User is not authenticated, show landing page
      return;
    }

    // Redirect based on role
    if (profile?.role === 'admin') {
      router.push('/admin');
    } else if (profile?.role === 'doctor') {
      router.push('/doctor');
    } else if (profile?.role === 'patient') {
      router.push('/patient');
    }
  }, [user, profile, loading, router]);

  // Show landing page for unauthenticated users
  if (!loading && !user) {
    return <LandingPage />;
  }

  // Show loading spinner while checking auth status
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Spinner className="mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

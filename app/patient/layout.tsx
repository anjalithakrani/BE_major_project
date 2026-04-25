'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui/spinner';
import { Navbar } from '@/components/navbar';

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  // Check auth after loading is complete
  if (!user) {
    console.log('[v0] Patient layout: No user, redirecting to login');
    router.push('/login');
    return null;
  }

  if (!profile) {
    console.log('[v0] Patient layout: No profile loaded, redirecting to login');
    router.push('/login');
    return null;
  }

  if (profile.role !== 'patient') {
    console.log('[v0] Patient layout: User role is', profile.role, 'not patient, redirecting');
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

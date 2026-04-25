'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'doctor' | 'patient';
  clinic_name?: string;
  license_number?: string;
  date_of_birth?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial user
    const getUser = async () => {
      console.log('[v0] AuthContext: Getting initial user');
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[v0] AuthContext: Got user:', user?.id);
      setUser(user);

      if (user) {
        // Fetch user profile
        console.log('[v0] AuthContext: Fetching profile for user:', user.id);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        console.log('[v0] AuthContext: Profile fetched:', profileData, profileError);
        setProfile(profileData || null);
      }
      setLoading(false);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[v0] AuthContext: Auth state changed:', event, session?.user?.id);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('[v0] AuthContext: Fetching profile on auth change for user:', session.user.id);
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          console.log('[v0] AuthContext: Profile fetched on auth change:', profileData, profileError);
          setProfile(profileData || null);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

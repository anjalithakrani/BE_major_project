'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Bell, LogOut, User, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getNavLinks = () => {
    if (profile?.role === 'patient') {
      return [
        { label: 'Dashboard', href: '/patient' },
        { label: 'Exercises', href: '/patient/exercises' },
      ];
    } else if (profile?.role === 'doctor') {
      return [
        { label: 'Dashboard', href: '/doctor' },
      ];
    } else if (profile?.role === 'admin') {
      return [
        { label: 'Patients', href: '/admin' },
        { label: 'Doctors', href: '/admin/doctors' },
      ];
    }
    return [];
  };

  const navLinks = getNavLinks();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={profile?.role === 'patient' ? '/patient' : profile?.role === 'doctor' ? '/doctor' : '/admin'} className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg overflow-hidden">
  <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
</div>
            <span className="font-bold text-lg text-gray-900 hidden sm:inline">PhysioCare</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-blue-600 font-medium transition"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center text-white text-sm font-bold">
                  {profile?.full_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="hidden sm:inline text-sm font-medium">{profile?.full_name}</span>
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                    <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

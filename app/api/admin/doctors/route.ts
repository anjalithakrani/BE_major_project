import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user : null;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data: doctors, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, license_number, clinic_name, phone, created_at')
    .eq('role', 'doctor')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ doctors });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { email, fullName, licenseNumber, clinicName, phone, password } = await request.json();

  if (!email || !fullName) {
    return NextResponse.json({ error: 'Email and full name are required' }, { status: 400 });
  }

  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: password || 'Doctor1234!',
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 400 });
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      email,
      full_name: fullName,
      license_number: licenseNumber || null,
      clinic_name: clinicName || null,
      phone: phone || null,
      role: 'doctor',
    });

  if (profileError) {
    await supabase.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ message: 'Doctor created successfully' }, { status: 201 });
}
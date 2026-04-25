import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // ✅ Get token from header
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // ✅ Normal client (for auth)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Admin client (bypass RLS)
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ Check doctor role
    const { data: doctorProfile, error: doctorError } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (doctorError || doctorProfile?.role !== 'doctor') {
      return NextResponse.json({ error: 'Only doctors can view patients' }, { status: 403 });
    }

    // ✅ Fetch patients
    const { data: relations, error: relError } = await adminSupabase
      .from('doctor_patient')
      .select(`
        id,
        patient_id,
        assigned_date,
        active,
        profiles:patient_id (
          id,
          full_name,
          email
        )
      `)
      .eq('doctor_id', user.id)
      .eq('active', true)
      .order('assigned_date', { ascending: false });

    if (relError) {
      return NextResponse.json({ error: relError.message }, { status: 400 });
    }

    return NextResponse.json(relations, { status: 200 });

  } catch (error) {
    console.error('Error fetching patients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // ✅ Get token
    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    // ✅ Auth client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Admin client
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
      return NextResponse.json({ error: 'Only doctors can add patients' }, { status: 403 });
    }

    // ✅ Get body
    const { patientEmail } = await request.json();

    if (!patientEmail) {
      return NextResponse.json({ error: 'Patient email is required' }, { status: 400 });
    }

    // ✅ Find patient
    const { data: patientProfile, error: patientError } = await adminSupabase
      .from('profiles')
      .select('id, role')
      .eq('email', patientEmail)
      .eq('role', 'patient')
      .single();

    if (patientError || !patientProfile) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    const patientId = patientProfile.id;

    // ✅ Check existing relation
    const { data: existingRelation } = await adminSupabase
      .from('doctor_patient')
      .select('id')
      .eq('doctor_id', user.id)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (existingRelation) {
      return NextResponse.json({ error: 'Patient already assigned' }, { status: 400 });
    }

    // ✅ Insert relation
    const { data: newRelation, error: insertError } = await adminSupabase
      .from('doctor_patient')
      .insert([
        {
          doctor_id: user.id,
          patient_id: patientId,
          active: true,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json(newRelation, { status: 201 });

  } catch (error) {
    console.error('Error adding patient:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
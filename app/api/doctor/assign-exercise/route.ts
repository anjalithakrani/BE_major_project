import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify doctor role
    const { data: doctorProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (doctorProfile?.role !== 'doctor') {
      return NextResponse.json({ error: 'Only doctors can assign exercises' }, { status: 403 });
    }

    const {
      patientId,
      exerciseId,
      repsTarget,
      setsTarget,
      angleThreshold,
      confidenceThreshold = 0.7,
      frequencyPerWeek = 3,
    } = await request.json();

    // Validate inputs
    if (!patientId || !exerciseId || !repsTarget || !setsTarget || angleThreshold === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify doctor-patient relationship
    const { data: relation } = await supabase
      .from('doctor_patient')
      .select('id')
      .eq('doctor_id', user.id)
      .eq('patient_id', patientId)
      .eq('active', true)
      .single();

    if (!relation) {
      return NextResponse.json({ error: 'Patient not assigned to this doctor' }, { status: 403 });
    }

    // Check if exercise already assigned
    const { data: existingAssignment } = await supabase
      .from('patient_exercises')
      .select('id')
      .eq('patient_id', patientId)
      .eq('exercise_id', exerciseId)
      .single();

    if (existingAssignment) {
      return NextResponse.json({ error: 'Exercise already assigned to patient' }, { status: 400 });
    }

    // Create patient exercise assignment
    const { data: assignment, error } = await supabase
      .from('patient_exercises')
      .insert([{
        patient_id: patientId,
        exercise_id: exerciseId,
        reps_target: repsTarget,
        sets_target: setsTarget,
        angle_threshold: angleThreshold,
        confidence_threshold: confidenceThreshold,
        frequency_per_week: frequencyPerWeek,
        assigned_by: user.id,
        active: true,
      }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error assigning exercise:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

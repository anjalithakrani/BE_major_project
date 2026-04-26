import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify patient role
    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'patient') {
      return NextResponse.json(
        { error: 'Only patients can start sessions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { patient_exercise_id, reps_target } = body;

    if (!patient_exercise_id || !reps_target) {
      return NextResponse.json(
        { error: 'patient_exercise_id and reps_target are required' },
        { status: 400 }
      );
    }

    // Verify this exercise belongs to this patient
    const { data: exercise } = await admin
      .from('patient_exercises')
      .select('id')
      .eq('id', patient_exercise_id)
      .eq('patient_id', user.id)
      .eq('active', true)
      .single();

    if (!exercise) {
      return NextResponse.json({ error: 'Exercise not found' }, { status: 404 });
    }

    // Create the session
    const { data: session, error: insertError } = await admin
      .from('sessions')
      .insert({
        patient_id: user.id,
        patient_exercise_id,
        reps_target,
        start_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error starting session:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
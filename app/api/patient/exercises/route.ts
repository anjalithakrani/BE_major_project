import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'patient') {
      return NextResponse.json(
        { error: 'Only patients can view exercises' },
        { status: 403 }
      );
    }

    const { data, error: fetchError } = await admin
  .from('patient_exercises')
  .select(`
    id,
    reps_target,
    sets_target,
    angle_threshold,
    confidence_threshold,
    frequency_per_week,
    assigned_date,
    exercise:exercise_id (
      id,
      name,
      description,
      body_part,
      instructions,
      video_url
    )
  `)
  .eq('patient_id', user.id)
  .eq('active', true)
  .order('assigned_date', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
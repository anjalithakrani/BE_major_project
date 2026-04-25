import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params;
    
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
      return NextResponse.json({ error: 'Only doctors can view patient progress' }, { status: 403 });
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get patient profile
    const { data: patientProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', patientId)
      .single();

    // Get patient's exercises
    const { data: exercises } = await supabase
      .from('patient_exercises')
      .select(`
        id,
        reps_target,
        sets_target,
        angle_threshold,
        exercise:exercise_id (
          id,
          name,
          body_part
        )
      `)
      .eq('patient_id', patientId)
      .eq('active', true);

    // Get patient's sessions with feedback
    const { data: sessions } = await supabase
      .from('sessions')
      .select(`
        id,
        start_time,
        end_time,
        completed,
        reps_completed,
        sets_completed,
        feedback,
        patient_exercise:patient_exercise_id (
          exercise:exercise_id (
            name
          )
        ),
        session_feedback (
          pain_level,
          difficulty_level,
          mood,
          comments
        )
      `)
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false })
      .limit(50);

    // Calculate statistics
    const totalSessions = sessions?.length || 0;
    const completedSessions = sessions?.filter(s => s.completed).length || 0;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    return NextResponse.json({
      patient: patientProfile,
      exercises,
      sessions,
      stats: {
        totalSessions,
        completedSessions,
        completionRate,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching patient progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

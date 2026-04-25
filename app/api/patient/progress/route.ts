import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

    // Verify patient role
    const { data: patientProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (patientProfile?.role !== 'patient') {
      return NextResponse.json({ error: 'Only patients can view their progress' }, { status: 403 });
    }

    // Get all sessions with feedback and exercise details
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        start_time,
        end_time,
        completed,
        reps_completed,
        sets_completed,
        patient_exercise:patient_exercise_id (
          reps_target,
          sets_target,
          exercise:exercise_id (
            name,
            body_part
          )
        ),
        session_feedback (
          pain_level,
          difficulty_level,
          mood
        )
      `)
      .eq('patient_id', user.id)
      .order('start_time', { ascending: false });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 400 });
    }

    // Calculate statistics
    const totalSessions = sessions?.length || 0;
    const completedSessions = sessions?.filter(s => s.completed).length || 0;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    // Calculate average accuracy (reps/sets completed vs target)
    let totalAccuracy = 0;
    let accuracyCount = 0;
    sessions?.forEach(session => {
      if (session.patient_exercise) {
        const repsAccuracy = (session.reps_completed / session.patient_exercise.reps_target) * 100;
        const setsAccuracy = (session.sets_completed / session.patient_exercise.sets_target) * 100;
        const sessionAccuracy = (repsAccuracy + setsAccuracy) / 2;
        totalAccuracy += Math.min(sessionAccuracy, 100); // Cap at 100%
        accuracyCount++;
      }
    });
    const averageAccuracy = accuracyCount > 0 ? Math.round(totalAccuracy / accuracyCount) : 0;

    // Get this week's sessions
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeekSessions = sessions?.filter(s => new Date(s.start_time) >= weekAgo).length || 0;

    return NextResponse.json({
      sessions,
      stats: {
        totalSessions,
        completedSessions,
        completionRate: Math.round(completionRate),
        averageAccuracy,
        thisWeekSessions,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching patient progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
          getAll() { return cookieStore.getAll(); },
        },
      }
    );

    // Verify Doctor Session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch Sessions specifically for the patientId provided in the URL
    const { data: sessions, error: sErr } = await supabase
      .from('sessions')
      .select(`
        id, start_time, completed, reps_completed, reps_target,
        patient_exercise:patient_exercise_id ( exercise:exercise_id ( name ) ),
        session_feedback ( pain_level, difficulty_level, mood )
      `)
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false });

    if (sErr) throw sErr;

    // Calculate Stats to match Patient Dashboard exactly
    const totalSessions = sessions?.length || 0;
    const completedSessions = sessions?.filter(s => s.completed).length || 0;
    const completionRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    let totalAcc = 0;
    let accCount = 0;
    sessions?.forEach(s => {
      if (s.reps_target > 0) {
        totalAcc += Math.min((s.reps_completed / s.reps_target) * 100, 100);
        accCount++;
      }
    });

    return NextResponse.json({
      sessions,
      stats: {
        totalSessions,
        completionRate,
        averageAccuracy: accCount > 0 ? Math.round(totalAcc / accCount) : 0,
        thisWeekSessions: totalSessions, // Adjust logic if needed for 7-day filter
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
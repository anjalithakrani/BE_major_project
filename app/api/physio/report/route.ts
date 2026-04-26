import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const FREE_MODELS = [
  'openrouter/free'
];

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'doctor' && profile?.role !== 'physio') {
      return NextResponse.json({ error: 'Only doctors can generate reports' }, { status: 403 });
    }

    const { patientId, patientName } = await request.json();
    if (!patientId) return NextResponse.json({ error: 'patientId required' }, { status: 400 });

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        id,
        start_time,
        reps_completed,
        reps_target,
        label_counts,
        patient_exercise_id,
        patient_exercises (
          exercises ( name, body_part )
        )
      `)
      .eq('patient_id', patientId)
      .gte('start_time', since.toISOString())
      .order('start_time', { ascending: false });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    const sessionIds = (sessions ?? []).map((s) => s.id);
    let feedbackRows: any[] = [];
    if (sessionIds.length > 0) {
      const { data: fb } = await supabase
        .from('session_feedback')
        .select('session_id, pain_level, difficulty_level, mood, comments')
        .in('session_id', sessionIds);
      feedbackRows = fb ?? [];
    }

    const feedbackBySession = Object.fromEntries(
      feedbackRows.map((f) => [f.session_id, f])
    );

    const enrichedSessions = (sessions ?? []).map((s) => ({
      date: s.start_time,
      exercise: (s as any).patient_exercises?.exercises?.name ?? 'Unknown',
      body_part: (s as any).patient_exercises?.exercises?.body_part ?? '',
      reps_completed: s.reps_completed,
      reps_target: s.reps_target,
      completion_rate: s.reps_target
        ? Math.round((s.reps_completed / s.reps_target) * 100)
        : null,
      label_counts: s.label_counts,
      feedback: feedbackBySession[s.id] ?? null,
    }));

    const byExercise: Record<string, any[]> = {};
    enrichedSessions.forEach((s) => {
      if (!byExercise[s.exercise]) byExercise[s.exercise] = [];
      byExercise[s.exercise].push(s);
    });

    const exerciseSummaries = Object.entries(byExercise).map(([name, rows]) => {
      const avgCompletion = Math.round(
        rows.reduce((a, r) => a + (r.completion_rate ?? 0), 0) / rows.length
      );
      const avgPain = rows
        .filter((r) => r.feedback?.pain_level != null)
        .reduce((a, r, _, arr) => a + r.feedback.pain_level / arr.length, 0);
      const moods = rows.filter((r) => r.feedback?.mood).map((r) => r.feedback.mood);
      const allLabels: Record<string, number> = {};
      rows.forEach((r) => {
        if (r.label_counts) {
          Object.values(r.label_counts as Record<string, Record<string, number>>).forEach((lc) => {
            Object.entries(lc).forEach(([label, count]) => {
              allLabels[label] = (allLabels[label] ?? 0) + (count as number);
            });
          });
        }
      });
      return {
        exercise: name,
        sessions: rows.length,
        avg_completion_rate: avgCompletion,
        avg_pain_level: avgPain ? Math.round(avgPain * 10) / 10 : null,
        moods,
        form_labels: allLabels,
        patient_comments: rows
          .filter((r) => r.feedback?.comments)
          .map((r) => r.feedback.comments),
      };
    });

    const prompt = `You are a physiotherapy assistant AI generating a professional progress report.

Patient: ${patientName}
Period: Last 30 days
Total sessions: ${enrichedSessions.length}

Exercise data:
${JSON.stringify(exerciseSummaries, null, 2)}

Generate a clear professional report with these sections:
1. **Executive Summary** — overall progress in 2-3 sentences
2. **Exercise Performance** — per exercise: sessions completed, completion rate, form quality based on label_counts (correct vs partial_motion vs elbow_flare etc)
3. **Pain & Wellbeing** — pain levels, mood trends, notable patient comments
4. **Observations** — form trends, consistency, areas of concern
5. **Recommendations** — specific actionable suggestions for next week

Be concise, clinical, and specific. Use the actual numbers from the data.`;

    // Try each free model in order until one succeeds
    let summary = '';
    let lastError = '';

    for (const model of FREE_MODELS) {
      try {
        console.log(`Trying model: ${model}`);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:3000',
            'X-Title': 'PhysioAssist',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'You are a physiotherapy assistant AI generating clinical progress reports.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.7,
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          const errMsg = data.error?.message ?? `HTTP ${response.status}`;
          console.warn(`Model ${model} failed: ${errMsg}`);
          lastError = errMsg;
          continue; // try next model
        }

        summary = data.choices?.[0]?.message?.content ?? '';
        if (!summary) {
          console.warn(`Model ${model} returned empty content`);
          lastError = 'Empty response';
          continue;
        }

        console.log(`✅ Report generated with model: ${model}`);
        break; // success
      } catch (err: any) {
        console.warn(`Model ${model} threw: ${err.message}`);
        lastError = err.message;
        continue;
      }
    }

    if (!summary) {
      return NextResponse.json(
        { error: `All models failed. Last error: ${lastError}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Report generation error:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
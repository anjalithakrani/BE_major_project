import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── Shared auth helper ─────────────────────────────────────────────────────
async function getAuthedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.split(' ')[1];
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── PATCH /api/patient/sessions/[id] ──────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params is a Promise, must await before accessing
    const { id } = await params;

    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { reps_completed, label_counts } = body;

    const updates: Record<string, unknown> = {};
    if (reps_completed !== undefined) updates.reps_completed = reps_completed;
    if (label_counts !== undefined) updates.label_counts = label_counts;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await admin
      .from('sessions')
      .update(updates)
      .eq('id', id)
      .eq('patient_id', user.id)
      .eq('completed', false)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── PUT /api/patient/sessions/[id] ────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15: params is a Promise, must await before accessing
    const { id } = await params;

    const user = await getAuthedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { reps_completed, label_counts } = body;

    const { data: existing, error: fetchError } = await admin
      .from('sessions')
      .select('start_time, completed')
      .eq('id', id)
      .eq('patient_id', user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (existing.completed) {
      return NextResponse.json({ error: 'Session already completed' }, { status: 400 });
    }

    const endTime = new Date();
    const startTime = new Date(existing.start_time);
    const durationSeconds = Math.round(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    const { data, error } = await admin
      .from('sessions')
      .update({
        end_time: endTime.toISOString(),
        duration_seconds: durationSeconds,
        reps_completed: reps_completed ?? 0,
        label_counts: label_counts ?? {},
        completed: true,
      })
      .eq('id', id)
      .eq('patient_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Error ending session:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
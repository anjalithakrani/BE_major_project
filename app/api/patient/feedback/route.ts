import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Read Bearer token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // Create a Supabase client authenticated with the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser(token);
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
      return NextResponse.json({ error: 'Only patients can submit feedback' }, { status: 403 });
    }

    const { sessionId, painLevel, difficultyLevel, mood, comments } = await request.json();

    if (!sessionId || painLevel === undefined || !difficultyLevel || !mood) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify this is the patient's session
    const { data: session } = await supabase
      .from('sessions')
      .select('patient_id')
      .eq('id', sessionId)
      .eq('patient_id', user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found or not authorized' }, { status: 403 });
    }

    // Upsert feedback (insert or update if duplicate)
    const { data: feedback, error: feedbackError } = await supabase
      .from('session_feedback')
      .insert([{
        session_id: sessionId,
        patient_id: user.id,
        pain_level: painLevel,
        difficulty_level: difficultyLevel,
        mood,
        comments: comments || null,
      }])
      .select()
      .single();

    if (feedbackError) {
      if (feedbackError.message.includes('duplicate')) {
        const { data: updatedFeedback, error: updateError } = await supabase
          .from('session_feedback')
          .update({
            pain_level: painLevel,
            difficulty_level: difficultyLevel,
            mood,
            comments: comments || null,
          })
          .eq('session_id', sessionId)
          .eq('patient_id', user.id)
          .select()
          .single();

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }

        return NextResponse.json(updatedFeedback, { status: 200 });
      }

      return NextResponse.json({ error: feedbackError.message }, { status: 400 });
    }

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
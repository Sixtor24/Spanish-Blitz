// @ts-nocheck
import { auth } from '@/auth';
import sql from '../../../utils/sql';
import { broadcastSessionRefresh } from '../../../utils/ws-hub';

async function getCurrentUserOr401() {
  const session = await auth();
  if (!session?.user?.email) return { error: { status: 401, body: { error: 'Not authenticated' } } };
  const rows = await sql`SELECT id, email FROM users WHERE email = ${session.user.email} LIMIT 1`;
  if (rows.length === 0) return { error: { status: 404, body: { error: 'User not found' } } };
  return { user: rows[0] };
}

async function ensurePlayer(sessionId, userId) {
  const rows = await sql`SELECT id, is_host FROM play_session_players WHERE session_id = ${sessionId} AND user_id = ${userId} LIMIT 1`;
  return rows[0];
}

export async function POST(request, { params }) {
  try {
    const { user, error } = await getCurrentUserOr401();
    if (error) return Response.json(error.body, { status: error.status });

    const sessionId = params.id;
    const body = await request.json();
    const questionId = body.questionId ?? body.question_id;
    const isCorrect = Boolean(body.isCorrect ?? body.is_correct);
    const answerText = body.answerText ?? null;

    if (!questionId) return Response.json({ error: 'questionId is required' }, { status: 400 });

    const sessionRows = await sql`SELECT id, is_teacher, host_user_id, status, ends_at FROM play_sessions WHERE id = ${sessionId} LIMIT 1`;
    if (sessionRows.length === 0) return Response.json({ error: 'Session not found' }, { status: 404 });
    const session = sessionRows[0];
    if (session.status === 'pending') {
      return Response.json({ error: 'Session has not started yet' }, { status: 400 });
    }
    if (session.status === 'completed' || session.status === 'cancelled') {
      return Response.json({ error: 'Session is not active' }, { status: 400 });
    }
    if (session.ends_at && new Date(session.ends_at).getTime() < Date.now()) {
      await sql`UPDATE play_sessions SET status = 'completed' WHERE id = ${sessionId}`;
      return Response.json({ error: 'Session time is over' }, { status: 400 });
    }

    const player = await ensurePlayer(sessionId, user.id);
    if (!player) return Response.json({ error: 'You are not in this session' }, { status: 403 });
    if (session.is_teacher && session.host_user_id === user.id) {
      return Response.json({ error: 'Teacher/host cannot answer' }, { status: 400 });
    }

    const pointsAwarded = isCorrect ? 2 : -1;

    const questionRows = await sql`SELECT id FROM play_session_questions WHERE id = ${questionId} AND session_id = ${sessionId} LIMIT 1`;
    if (questionRows.length === 0) {
      return Response.json({ error: 'Question not found in this session' }, { status: 404 });
    }

    const existing = await sql`SELECT id FROM play_session_answers WHERE question_id = ${questionId} AND player_id = ${player.id} LIMIT 1`;
    if (existing.length > 0) {
      return Response.json({ error: 'Question already answered' }, { status: 400 });
    }

    await sql`
      INSERT INTO play_session_answers (session_id, player_id, question_id, is_correct, points_awarded, answer_text)
      VALUES (${sessionId}, ${player.id}, ${questionId}, ${isCorrect}, ${pointsAwarded}, ${answerText})
    `;

    await sql`
      UPDATE play_session_players
      SET score = score + ${pointsAwarded}
      WHERE id = ${player.id}
    `;

    await sql`
      UPDATE play_session_players p
      SET state = 'finished'
      WHERE p.id = ${player.id}
        AND (SELECT count(*)::int FROM play_session_answers a WHERE a.player_id = p.id) >= (SELECT count(*)::int FROM play_session_questions q WHERE q.session_id = ${sessionId})
    `;

    const remaining = await sql`
      SELECT count(*)::int AS cnt
      FROM play_session_players
      WHERE session_id = ${sessionId}
        AND state = 'playing'
        AND (NOT (is_host = true AND ${session.is_teacher}))
    `;

    if (remaining[0].cnt === 0) {
      await sql`UPDATE play_sessions SET status = 'completed' WHERE id = ${sessionId}`;
    }

    broadcastSessionRefresh(sessionId);

    return Response.json({ ok: true, points: pointsAwarded });
  } catch (err) {
    console.error('Error submitting answer:', err);
    return Response.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}

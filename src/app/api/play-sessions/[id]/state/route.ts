// @ts-nocheck
import { auth } from '@/auth';
import sql from '../../../utils/sql';

async function getCurrentUserOr401() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: { status: 401, body: { error: 'Not authenticated' } } };
  }
  const rows = await sql`
    SELECT id, email, display_name FROM users WHERE email = ${session.user.email} LIMIT 1
  `;
  if (rows.length === 0) return { error: { status: 404, body: { error: 'User not found' } } };
  return { user: rows[0] };
}

async function buildState(sessionId, currentUserId) {
  const [sessionRows, playerRows, questionRows, answerRows] = await Promise.all([
    sql`SELECT ps.id, ps.code, ps.is_teacher, ps.host_user_id, ps.question_count, ps.time_limit_seconds, ps.status, ps.started_at, ps.ends_at, d.title as deck_title
        FROM play_sessions ps
        JOIN decks d ON d.id = ps.deck_id
        WHERE ps.id = ${sessionId}
        LIMIT 1`,
    sql`
      SELECT p.id, p.user_id, p.score, p.state, p.is_host, u.display_name, u.email,
        (SELECT count(*)::int FROM play_session_answers a WHERE a.player_id = p.id) AS answered_count
      FROM play_session_players p
      JOIN users u ON u.id = p.user_id
      WHERE p.session_id = ${sessionId}
    `,
    sql`
      SELECT q.id, q.card_id, q.position,
  c.question, c.answer, c.type,
  /* translation_en may not exist; alias to answer (English) to keep UI shape */
  c.answer AS translation_en,
  /* Spanish prompt/answer come from the question side */
  c.question AS prompt_es,
  c.question AS answer_es
      FROM play_session_questions q
      JOIN cards c ON c.id = q.card_id
      WHERE q.session_id = ${sessionId}
      ORDER BY q.position ASC
    `,
    sql`SELECT a.id, a.player_id, a.question_id, a.is_correct, a.points_awarded FROM play_session_answers a WHERE a.session_id = ${sessionId} AND a.player_id = (SELECT id FROM play_session_players WHERE session_id = ${sessionId} AND user_id = ${currentUserId} LIMIT 1)`
  ]);

  const session = sessionRows[0];
  const isTeacherHost = session?.is_teacher && session?.host_user_id === currentUserId;
  const totalQuestions = questionRows.length;

  const sanitizedQuestions = isTeacherHost
    ? []
    : questionRows.map((q) => q);

  return {
    session,
    players: playerRows,
    questions: sanitizedQuestions,
    totalQuestions,
    currentPlayerAnswers: answerRows,
  };
}

export async function GET(request, { params }) {
  try {
    const { user, error } = await getCurrentUserOr401();
    if (error) return Response.json(error.body, { status: error.status });

    const sessionId = params.id;
    const sessionRows = await sql`SELECT id FROM play_sessions WHERE id = ${sessionId} LIMIT 1`;
    if (sessionRows.length === 0) return Response.json({ error: 'Session not found' }, { status: 404 });

    const state = await buildState(sessionId, user.id);
    return Response.json(state);
  } catch (err) {
    console.error('Error fetching session state:', err);
    return Response.json({ error: 'Failed to fetch session state' }, { status: 500 });
  }
}

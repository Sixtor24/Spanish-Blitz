// @ts-nocheck
import { auth } from '@/auth';
import sql from '../../../utils/sql';
import { broadcastSessionRefresh } from '../../../utils/ws-hub';

async function getCurrentUserOr401() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: { status: 401, body: { error: 'Not authenticated' } } };
  }
  const rows = await sql`
    SELECT id, email, role FROM users WHERE email = ${session.user.email} LIMIT 1
  `;
  if (rows.length === 0) return { error: { status: 404, body: { error: 'User not found' } } };
  return { user: rows[0] };
}

export async function POST(request, { params }) {
  try {
    const { user, error } = await getCurrentUserOr401();
    if (error) return Response.json(error.body, { status: error.status });

    const sessionId = params.id;
    const sessions = await sql`SELECT id, host_user_id, status, time_limit_seconds FROM play_sessions WHERE id = ${sessionId} LIMIT 1`;
    if (sessions.length === 0) return Response.json({ error: 'Session not found' }, { status: 404 });
    const session = sessions[0];

    if (session.host_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Only host or admin can start the session' }, { status: 403 });
    }

    if (session.status !== 'pending') {
      return Response.json({ error: 'Session already started or finished' }, { status: 400 });
    }

    const playerCountRows = await sql`SELECT count(*)::int AS cnt FROM play_session_players WHERE session_id = ${sessionId}`;
    if (playerCountRows[0].cnt < 2) {
      return Response.json({ error: 'Need at least 2 players to start' }, { status: 400 });
    }

    const startsAt = new Date();
    const endsAt = session.time_limit_seconds ? new Date(startsAt.getTime() + session.time_limit_seconds * 1000) : null;

    await sql`
      UPDATE play_sessions
      SET status = 'active', started_at = ${startsAt}, ends_at = ${endsAt}
      WHERE id = ${sessionId}
    `;

    broadcastSessionRefresh(sessionId);
    return Response.json({ ok: true, started_at: startsAt, ends_at: endsAt });
  } catch (err) {
    console.error('Error starting session:', err);
    return Response.json({ error: 'Failed to start session' }, { status: 500 });
  }
}

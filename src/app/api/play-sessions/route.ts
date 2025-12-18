// @ts-nocheck
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import sql from "../utils/sql";
import { broadcastSessionRefresh } from "../utils/ws-hub";

const CODE_LENGTH = 6;

const genCode = () => nanoid(CODE_LENGTH).toUpperCase();

async function getCurrentUserOr401() {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: { status: 401, body: { error: "Not authenticated" } } };
  }
  const rows = await sql`
    SELECT id, email, plan, role, is_premium, display_name
    FROM users
    WHERE email = ${session.user.email}
    LIMIT 1
  `;
  if (rows.length === 0) {
    return { error: { status: 404, body: { error: "User not found" } } };
  }
  return { user: rows[0] };
}

export async function POST(request) {
  try {
    const { user, error } = await getCurrentUserOr401();
    if (error) return Response.json(error.body, { status: error.status });

    // Only premium or admin can create sessions
    const canCreate = user.is_premium || user.plan === "premium" || user.role === "admin";
    if (!canCreate) {
      return Response.json({ error: "Only premium users can create challenges" }, { status: 403 });
    }

    const body = await request.json();
    const deckId = body.deckId ?? body.deck_id;
    const rawTimeLimitMinutes = Number(body.timeLimitMinutes ?? body.time_limit_minutes ?? 0);
    const timeLimitMinutes = Number.isFinite(rawTimeLimitMinutes) ? Math.max(0, Math.min(rawTimeLimitMinutes, 60)) : 0; // clamp to 0-60 min
  const questionCount = Math.max(1, Math.min(Number(body.questionCount ?? body.question_count ?? 10), 50));
    const isTeacher = Boolean(body.isTeacher ?? body.is_teacher);

    if (!deckId) {
      return Response.json({ error: "deckId is required" }, { status: 400 });
    }

    // Pick questions (random order, clamp to deck size)
    const cards = await sql`
      SELECT
        id,
        question,
        answer,
        type,
        /* Not all DBs have translation_en; alias to answer to keep shape */
        answer AS translation_en,
        /* Aliases to satisfy UI expectations without requiring extra columns */
        question AS prompt_es,
        answer AS answer_es
      FROM cards
      WHERE deck_id = ${deckId}
      ORDER BY random()
      LIMIT ${questionCount}
    `;

    if (cards.length === 0) {
      return Response.json({ error: "Deck has no cards" }, { status: 400 });
    }

    const finalQuestionCount = Math.min(questionCount, cards.length);
    const code = genCode();
    const timeLimitSeconds = timeLimitMinutes ? Number(timeLimitMinutes) * 60 : null;

    const selectedCards = cards.slice(0, finalQuestionCount);

    const sessionRows = await sql`
      INSERT INTO play_sessions (
        host_user_id,
        deck_id,
        mode,
        is_teacher,
        question_count,
        time_limit_seconds,
        status,
        started_at,
        ends_at,
        code
      ) VALUES (
        ${user.id},
        ${deckId},
        'blitz_challenge',
        ${isTeacher},
        ${finalQuestionCount},
        ${timeLimitSeconds},
        'pending',
        NULL,
        NULL,
        ${code}
      )
      RETURNING id, code, is_teacher, question_count, time_limit_seconds, ends_at
    `;

    const session = sessionRows[0];

    await sql`
      INSERT INTO play_session_players (session_id, user_id, is_host, state, score)
      VALUES (${session.id}, ${user.id}, true, ${isTeacher ? "finished" : "playing"}, 0)
      ON CONFLICT DO NOTHING
    `;

    await Promise.all(
      selectedCards.map((card, idx) =>
        sql`
          INSERT INTO play_session_questions (session_id, card_id, position, points_correct, points_incorrect)
          VALUES (${session.id}, ${card.id}, ${idx + 1}, 2, -1)
        `
      )
    );

    // Notify listeners to refresh session state
    broadcastSessionRefresh(session.id);

    return Response.json({
      sessionId: session.id,
      code: session.code,
      isTeacher,
      questionCount: session.question_count,
      timeLimitSeconds: session.time_limit_seconds,
      endsAt: session.ends_at,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.error("Error creating blitz challenge:", error);
    return Response.json(
      { error: "Failed to create blitz challenge" },
      { status: 500 }
    );
  }
}

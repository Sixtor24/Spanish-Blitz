import sql from "../utils/sql";
import { getCurrentUser, requireAuth } from "@/lib/auth/require-auth";
import { withErrorHandler } from "@/lib/utils/error-handler";
import type { CreateStudyEventBody } from "@/lib/types/api.types";

export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAuth();
  const user = await getCurrentUser(sql, session);
  const userId = user.id;

  const body = await request.json() as CreateStudyEventBody & {
    deck_id?: string;
    mode?: string;
    response_type?: string;
    transcript_es?: string;
  };
  const { deck_id, card_id, result, mode, response_type, transcript_es } = body;

    const rows = await sql`
      INSERT INTO study_events (user_id, deck_id, card_id, result, mode, response_type, transcript_es)
      VALUES (${userId}, ${deck_id}, ${card_id}, ${result}, ${mode}, ${response_type}, ${transcript_es})
      RETURNING *
    `;

  return Response.json(rows[0]);
}, 'POST /api/study-events');

import sql from "../utils/sql";
import { getCurrentUser, requireAuth } from "@/lib/auth/require-auth";
import { withErrorHandler } from "@/lib/utils/error-handler";
import type { StatsResponse } from "@/lib/types/api.types";

export const GET = withErrorHandler(async (request: Request) => {
  const session = await requireAuth();
  const user = await getCurrentUser(sql, session);
  const userId = user.id;

    // Get total cards studied
    const studiedRows = await sql`
      SELECT COUNT(DISTINCT card_id) as count
      FROM study_events
      WHERE user_id = ${userId}
    `;

    const cardsStudied = studiedRows[0]?.count || 0;

    // Get accuracy
    const accuracyRows = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE result = 'correct') as correct,
        COUNT(*) as total
      FROM study_events
      WHERE user_id = ${userId}
    `;

    const correct = Number(accuracyRows[0]?.correct || 0);
    const total = Number(accuracyRows[0]?.total || 0);
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Get streak (simplified - days with at least one study event)
    const streakRows = await sql`
      SELECT COUNT(DISTINCT DATE(created_at)) as streak
      FROM study_events
      WHERE user_id = ${userId}
        AND created_at >= NOW() - INTERVAL '30 days'
    `;

    const streak = streakRows[0]?.streak || 0;

  const response: StatsResponse = {
    cardsStudied: Number(cardsStudied),
    accuracy,
    streak: Number(streak),
  };

  return Response.json(response);
}, 'GET /api/stats');

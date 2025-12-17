// @ts-nocheck
import sql from "../utils/sql";

export async function GET(request) {
  try {
    // Get guest user ID
    const userRows = await sql`
      SELECT id FROM users WHERE email = 'guest@thespanishlearningclub.com' LIMIT 1
    `;

    if (userRows.length === 0) {
      return Response.json({ cardsStudied: 0, accuracy: 0, streak: 0 });
    }

    const userId = userRows[0].id;

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

    return Response.json({
      cardsStudied: Number(cardsStudied),
      accuracy,
      streak: Number(streak),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}

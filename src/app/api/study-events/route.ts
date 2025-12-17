// @ts-nocheck
import sql from "../utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();
    const { deck_id, card_id, result, mode, response_type, transcript_es } =
      body;

    // Get guest user ID
    const userRows = await sql`
      SELECT id FROM users WHERE email = 'guest@thespanishlearningclub.com' LIMIT 1
    `;

    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRows[0].id;

    const rows = await sql`
      INSERT INTO study_events (user_id, deck_id, card_id, result, mode, response_type, transcript_es)
      VALUES (${userId}, ${deck_id}, ${card_id}, ${result}, ${mode}, ${response_type}, ${transcript_es})
      RETURNING *
    `;

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error creating study event:", error);
    return Response.json(
      { error: "Failed to create study event" },
      { status: 500 },
    );
  }
}

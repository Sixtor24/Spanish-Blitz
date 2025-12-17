// @ts-nocheck
import sql from "../utils/sql";

export async function POST(request) {
  try {
    const body = await request.json();
    const { deck_id, score, accuracy, ended_at } = body;

    // Get guest user ID
    const userRows = await sql`
      SELECT id FROM users WHERE email = 'guest@thespanishlearningclub.com' LIMIT 1
    `;

    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRows[0].id;

    const rows = await sql`
      INSERT INTO play_sessions (user_id, deck_id, score, accuracy, ended_at)
      VALUES (${userId}, ${deck_id}, ${score}, ${accuracy}, ${ended_at})
      RETURNING *
    `;

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error creating play session:", error);
    return Response.json(
      { error: "Failed to create play session" },
      { status: 500 },
    );
  }
}

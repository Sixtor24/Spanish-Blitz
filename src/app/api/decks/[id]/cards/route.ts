// @ts-nocheck
import sql from "../../../utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const rows = await sql`
      SELECT *
      FROM cards
      WHERE deck_id = ${id}
      ORDER BY created_at ASC
    `;

    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching cards:", error);
    return Response.json({ error: "Failed to fetch cards" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const {
      prompt_es,
      answer_es,
      distractor_1_es,
      distractor_2_es,
      distractor_3_es,
      notes,
      translation_en,
    } = body;

    // Check user plan and card limit
    const userRows = await sql`
      SELECT u.plan 
      FROM users u
      JOIN decks d ON d.owner_user_id = u.id
      WHERE d.id = ${id} AND u.email = 'guest@thespanishlearningclub.com'
      LIMIT 1
    `;

    if (userRows.length > 0 && userRows[0].plan === "free") {
      const cardCountRows = await sql`
        SELECT COUNT(*) as count FROM cards WHERE deck_id = ${id}
      `;
      const cardCount = parseInt(cardCountRows[0].count);

      if (cardCount >= 20) {
        return Response.json(
          {
            error:
              "Free accounts are limited to 20 cards per set. Upgrade to Premium for unlimited cards.",
            limit_exceeded: true,
            limit_type: "cards",
          },
          { status: 403 },
        );
      }
    }

    const rows = await sql`
      INSERT INTO cards (deck_id, prompt_es, answer_es, distractor_1_es, distractor_2_es, distractor_3_es, notes, translation_en)
      VALUES (${id}, ${prompt_es}, ${answer_es || prompt_es}, ${distractor_1_es || null}, ${distractor_2_es || null}, ${distractor_3_es || null}, ${notes || null}, ${translation_en || null})
      RETURNING *
    `;

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error creating card:", error);
    return Response.json({ error: "Failed to create card" }, { status: 500 });
  }
}

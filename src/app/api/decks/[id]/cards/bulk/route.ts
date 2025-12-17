// @ts-nocheck
import sql from "../../../../utils/sql";

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { cards } = body;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return Response.json(
        { error: "Cards array is required" },
        { status: 400 },
      );
    }

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
      const currentCardCount = parseInt(cardCountRows[0].count);
      const newTotalCards = currentCardCount + cards.length;

      if (newTotalCards > 20) {
        const remainingSlots = Math.max(0, 20 - currentCardCount);
        return Response.json(
          {
            error: `Free accounts are limited to 20 cards per set. You can add ${remainingSlots} more card(s). Upgrade to Premium for unlimited cards.`,
            limit_exceeded: true,
            limit_type: "cards",
            current_count: currentCardCount,
            max_allowed: 20,
            remaining_slots: remainingSlots,
          },
          { status: 403 },
        );
      }
    }

    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    cards.forEach((card) => {
      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`,
      );
      values.push(
        id,
        card.prompt_es,
        card.answer_es,
        card.translation_en || null,
      );
      paramIndex += 4;
    });

    const query = `
      INSERT INTO cards (deck_id, prompt_es, answer_es, translation_en)
      VALUES ${placeholders.join(", ")}
      RETURNING *
    `;

    const result = await sql(query, values);

    return Response.json({ cards: result, count: result.length });
  } catch (error) {
    console.error("Error creating cards in bulk:", error);
    return Response.json({ error: "Failed to create cards" }, { status: 500 });
  }
}

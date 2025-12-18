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

    // Check user plan and card limit. Compare using owner_id (uuid) or owner_user_id text -> uuid string
    const userRows = await sql`
      SELECT u.plan 
      FROM users u
      JOIN decks d ON (
        (d.owner_id IS NOT NULL AND d.owner_id = u.id)
        OR (d.owner_user_id IS NOT NULL AND d.owner_user_id::text = u.id::text)
      )
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

    // Map incoming fields to existing schema (cards.question, cards.answer, type)
    const values = [];
    const placeholders = [];
    let paramIndex = 1;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const question = (card.prompt_es || card.question || "").trim();
      const answer =
        (card.translation_en || card.answer_es || card.answer || "").trim();

      if (!question || !answer) {
        return Response.json(
          {
            error: `Each card needs a Spanish prompt and an English meaning (issue on line ${i + 1}).`,
          },
          { status: 400 },
        );
      }

      placeholders.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`,
      );
      values.push(id, question, answer);
      paramIndex += 3;
    }

    const query = `
      INSERT INTO cards (deck_id, question, answer)
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

// @ts-nocheck
import sql from "../../utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    const rows = await sql`
      SELECT 
        d.*,
        COUNT(c.id) as card_count
      FROM decks d
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE d.id = ${id}
      GROUP BY d.id
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Deck not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error fetching deck:", error);
    return Response.json({ error: "Failed to fetch deck" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { title, description, is_public, primary_color_hex } = body;

    const rows = await sql`
      UPDATE decks
      SET 
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        is_public = COALESCE(${is_public}, is_public),
        primary_color_hex = COALESCE(${primary_color_hex}, primary_color_hex),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return Response.json({ error: "Deck not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error updating deck:", error);
    return Response.json({ error: "Failed to update deck" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    await sql`DELETE FROM decks WHERE id = ${id}`;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting deck:", error);
    return Response.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}

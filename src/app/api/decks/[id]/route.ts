// @ts-nocheck
import sql from "../../utils/sql";

async function ensureDeckColumns() {
  await sql`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS title text;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS name text;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS description text;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS owner_user_id integer;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ALTER COLUMN owner_user_id TYPE text USING owner_user_id::text;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS owner_id uuid;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS primary_color_hex text;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT NOW();
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE decks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();
      EXCEPTION WHEN others THEN NULL; END;
    END$$;
  `;
}

export async function GET(request, { params }) {
  try {
    const { id } = params;

  await ensureDeckColumns();

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

  await ensureDeckColumns();

    let rows;
    try {
      rows = await sql`
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
    } catch (err) {
      const message = (err?.message || "").toLowerCase();
      if (message.includes("primary_color_hex") && message.includes("column")) {
        rows = await sql`
          UPDATE decks
          SET 
            title = COALESCE(${title}, title),
            description = COALESCE(${description}, description),
            is_public = COALESCE(${is_public}, is_public),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING *
        `;
      } else {
        throw err;
      }
    }

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

import sql from "../utils/sql";
import { requireAuth, getCurrentUser } from "@/lib/auth/require-auth";
import { withErrorHandler } from "@/lib/utils/error-handler";
import type { CreateDeckBody } from "@/lib/types/api.types";

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
        -- if owner_user_id exists but is integer, widen to text to accept UUIDs
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

export const GET = withErrorHandler(async (request: Request) => {
  const session = await requireAuth();
  const user = await getCurrentUser(sql, session);
  const userId = user.id;
  const userIdText = String(userId);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const filter = searchParams.get("filter"); // all, owned, assigned, public

    await ensureDeckColumns();

    let query = `
      SELECT 
        d.id,
        d.title,
        d.description,
        d.owner_user_id,
        d.is_public,
        d.primary_color_hex,
        d.created_at,
        d.updated_at,
        COUNT(c.id) as card_count
      FROM decks d
      LEFT JOIN cards c ON c.deck_id = d.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Apply filter
    if (filter === "owned") {
  query += ` AND d.owner_user_id = $${paramIndex}`;
  params.push(userIdText);
      paramIndex++;
    } else if (filter === "assigned") {
      query += ` AND EXISTS (
        SELECT 1 FROM user_decks ud 
        WHERE ud.deck_id = d.id AND ud.user_id = $${paramIndex}
      )`;
      params.push(userId);
      paramIndex++;
    } else if (filter === "public") {
      query += ` AND d.is_public = true`;
    }

    // Apply search
    if (search) {
      query += ` AND (
        LOWER(d.title) LIKE LOWER($${paramIndex})
        OR LOWER(d.description) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY d.id ORDER BY d.created_at DESC`;

    let rows;
    try {
      rows = await sql(query, params);
    } catch (err) {
      const message = (err?.message || "").toLowerCase();
      if (message.includes("primary_color_hex") && message.includes("column")) {
        const fallback = query.replace(/,\s*d\.primary_color_hex,/i, ",").replace(/d\.primary_color_hex,?/gi, "");
        rows = await sql(fallback, params);
      } else {
        throw err;
      }
    }

  return Response.json(rows);
}, 'GET /api/decks');

export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAuth();
  const user = await getCurrentUser(sql, session);
  const userId = user.id;
  const userIdText = String(userId);

  const body = await request.json() as CreateDeckBody & { name?: string };
  const { title, name: incomingName, description, is_public, primary_color_hex } = body;

    const name = title || incomingName;
    if (!name) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

  // Ensure schema is compatible before any queries/inserts
  await ensureDeckColumns();
  
  const userPlan = user.plan;

    // Check deck limit for free users
    if (userPlan === "free") {
      const deckCountRows = await sql`
  SELECT COUNT(*) as count FROM decks WHERE owner_user_id = ${userIdText}
      `;
      const deckCount = parseInt(deckCountRows[0].count);

      if (deckCount >= 3) {
        return Response.json(
          {
            error:
              "Free accounts can create up to 3 sets. Upgrade to Premium to create unlimited sets.",
            limit_exceeded: true,
            limit_type: "decks",
          },
          { status: 403 },
        );
      }
    }

    let rows;
    try {
      rows = await sql`
        INSERT INTO decks (name, title, description, owner_user_id, owner_id, is_public, primary_color_hex)
        VALUES (${name}, ${title || name}, ${description}, ${userIdText}, ${userId}, ${is_public || false}, ${primary_color_hex || null})
        RETURNING *
      `;
    } catch (err) {
      // Fallback for older schemas that may not have primary_color_hex column
      const message = (err?.message || "").toLowerCase();
      if (message.includes("primary_color_hex") && message.includes("column") ) {
        await ensureDeckColumns();
        rows = await sql`
          INSERT INTO decks (name, title, description, owner_user_id, owner_id, is_public)
          VALUES (${name}, ${title || name}, ${description}, ${userIdText}, ${userId}, ${is_public || false})
          RETURNING *
        `;
      } else if (message.includes("title") && message.includes("column")) {
        await ensureDeckColumns();
        rows = await sql`
          INSERT INTO decks (name, title, description, owner_user_id, owner_id, is_public, primary_color_hex)
          VALUES (${name}, ${title || name}, ${description}, ${userIdText}, ${userId}, ${is_public || false}, ${primary_color_hex || null})
          RETURNING *
        `;
      } else {
        throw err;
      }
    }

  return Response.json(rows[0]);
}, 'POST /api/decks');

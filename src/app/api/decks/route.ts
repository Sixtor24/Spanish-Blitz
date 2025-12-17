// @ts-nocheck
import sql from "../utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const filter = searchParams.get("filter"); // all, owned, assigned, public

    // Get current user ID
    const userRows = await sql`
      SELECT id FROM users WHERE email = ${session.user.email} LIMIT 1
    `;

    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRows[0].id;

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
      params.push(userId);
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

    const rows = await sql(query, params);

    return Response.json(rows);
  } catch (error) {
    console.error("Error fetching decks:", error);
    return Response.json({ error: "Failed to fetch decks" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, is_public, primary_color_hex } = body;

    // Get current user ID and plan
    const userRows = await sql`
      SELECT id, plan FROM users WHERE email = ${session.user.email} LIMIT 1
    `;

    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRows[0].id;
    const userPlan = userRows[0].plan;

    // Check deck limit for free users
    if (userPlan === "free") {
      const deckCountRows = await sql`
        SELECT COUNT(*) as count FROM decks WHERE owner_user_id = ${userId}
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

    const rows = await sql`
      INSERT INTO decks (title, description, owner_user_id, is_public, primary_color_hex)
      VALUES (${title}, ${description}, ${userId}, ${is_public || false}, ${primary_color_hex || null})
      RETURNING *
    `;

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error creating deck:", error);
    return Response.json({ error: "Failed to create deck" }, { status: 500 });
  }
}

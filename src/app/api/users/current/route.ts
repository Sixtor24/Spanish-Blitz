// @ts-nocheck
import sql from "../../utils/sql";
import { auth } from "@/auth";

// Get current user
export async function GET(request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const rows = await sql`
      SELECT id, email, display_name, role, preferred_locale, is_premium, plan, has_seen_welcome, created_at, updated_at
      FROM users
      WHERE email = ${session.user.email}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// Update current user
export async function PATCH(request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { display_name, preferred_locale } = body;

    const rows = await sql`
      UPDATE users
      SET 
        display_name = COALESCE(${display_name}, display_name),
        preferred_locale = COALESCE(${preferred_locale}, preferred_locale),
        updated_at = NOW()
      WHERE email = ${session.user.email}
      RETURNING id, email, display_name, role, preferred_locale, is_premium, plan, has_seen_welcome, created_at, updated_at
    `;

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error updating user:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

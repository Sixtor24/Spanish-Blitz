// @ts-nocheck
import sql from "../../utils/sql";

// Mark welcome as seen for current user
export async function POST(request) {
  try {
    const rows = await sql`
      UPDATE users
      SET 
        has_seen_welcome = true,
        updated_at = NOW()
      WHERE email = 'guest@thespanishlearningclub.com'
      RETURNING id, email, display_name, role, preferred_locale, is_premium, plan, has_seen_welcome
    `;

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error marking welcome as seen:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

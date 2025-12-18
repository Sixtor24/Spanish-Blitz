import sql from "../../utils/sql";
import { requireAuth } from "@/lib/auth/require-auth";
import { withErrorHandler } from "@/lib/utils/error-handler";

async function ensureUserColumns() {
  await sql`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_locale text;
      EXCEPTION WHEN others THEN NULL; END;
      BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_welcome boolean DEFAULT false;
      EXCEPTION WHEN others THEN NULL; END;
    END$$;
  `;
}

// Mark welcome as seen for current user
export const POST = withErrorHandler(async (request: Request) => {
  const session = await requireAuth();
  
  await ensureUserColumns();
  
  const rows = await sql`
    UPDATE users
    SET 
      has_seen_welcome = true,
      updated_at = NOW()
    WHERE email = ${session.user.email}
    RETURNING id, email, display_name, role, preferred_locale, is_premium, plan, has_seen_welcome
  `;

  if (rows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json(rows[0]);
}, 'POST /api/users/mark-welcome-seen');

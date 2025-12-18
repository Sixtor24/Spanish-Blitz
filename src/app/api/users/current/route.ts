import sql from "../../utils/sql";
import { requireAuth } from "@/lib/auth/require-auth";
import { withErrorHandler } from "@/lib/utils/error-handler";
import type { UpdateUserBody } from "@/lib/types/api.types";

async function ensureUserColumns() {
  // Add preferred_locale and has_seen_welcome if they are missing
  await sql`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_locale text;
      EXCEPTION WHEN others THEN
        NULL;
      END;
      BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS has_seen_welcome boolean DEFAULT false;
      EXCEPTION WHEN others THEN
        NULL;
      END;
    END$$;
  `;
}

// Get current user
export const GET = withErrorHandler(async (request: Request) => {
  const session = await requireAuth();

    await ensureUserColumns();

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
}, 'GET /api/users/current');

// Update current user
export const PATCH = withErrorHandler(async (request: Request) => {
  const session = await requireAuth();
  const body = await request.json() as UpdateUserBody;
  const { display_name, preferred_locale } = body;

  await ensureUserColumns();

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
}, 'PATCH /api/users/current');

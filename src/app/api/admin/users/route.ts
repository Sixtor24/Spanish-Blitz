import sql from "../../utils/sql";
import { requireAdmin } from "@/lib/auth/require-auth";
import { withErrorHandler } from "@/lib/utils/error-handler";

// Get all users (admin only)
export const GET = withErrorHandler(async (request: Request) => {
  await requireAdmin(sql);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const roleFilter = searchParams.get("role");
    const planFilter = searchParams.get("plan");

    let query = `
      SELECT 
        u.id,
        u.email,
        u.display_name,
        u.role,
        u.is_premium,
        u.plan,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Apply search
    if (search) {
      query += ` AND (
        LOWER(u.email) LIKE LOWER($${paramIndex})
        OR LOWER(u.display_name) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Apply role filter
    if (roleFilter && roleFilter !== "all") {
      query += ` AND u.role = $${paramIndex}`;
      params.push(roleFilter);
      paramIndex++;
    }

    // Apply plan filter
    if (planFilter && planFilter !== "all") {
      query += ` AND u.plan = $${paramIndex}`;
      params.push(planFilter);
      paramIndex++;
    }

    query += ` ORDER BY u.created_at DESC`;

  const rows = await sql(query, params);

  return Response.json(rows);
}, 'GET /api/admin/users');

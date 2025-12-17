// @ts-nocheck
import sql from "../../utils/sql";
import { auth } from "@/auth";

// Get all users (admin only)
export async function GET(request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get current user and check if admin
    const adminRows = await sql`
      SELECT role FROM users WHERE email = ${session.user.email} LIMIT 1
    `;

    if (adminRows.length === 0 || adminRows[0].role !== "admin") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

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
  } catch (error) {
    console.error("Error fetching users:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

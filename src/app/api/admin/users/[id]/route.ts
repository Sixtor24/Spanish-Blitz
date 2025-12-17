// @ts-nocheck
import sql from "../../../utils/sql";
import { auth } from "@/auth";

// Update user role and premium status (admin only)
export async function PATCH(request, { params }) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get current user and check if admin
    const adminRows = await sql`
      SELECT id, role FROM users WHERE email = ${session.user.email} LIMIT 1
    `;

    if (adminRows.length === 0 || adminRows[0].role !== "admin") {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const currentAdminId = adminRows[0].id;
    const { id } = params;
    const body = await request.json();
    const { role, is_premium } = body;

    // Prevent admin from removing their own admin role
    if (id === currentAdminId && role && role !== "admin") {
      return Response.json(
        { error: "You cannot remove your own admin role" },
        { status: 400 },
      );
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (is_premium !== undefined) {
      updates.push(`is_premium = $${paramIndex}`);
      values.push(is_premium);
      paramIndex++;

      // Update plan based on is_premium
      updates.push(`plan = $${paramIndex}`);
      values.push(is_premium ? "premium" : "free");
      paramIndex++;
    }

    if (updates.length === 0) {
      return Response.json({ error: "No updates provided" }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, email, display_name, role, is_premium, plan, created_at, updated_at
    `;

    const rows = await sql(query, values);

    if (rows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(rows[0]);
  } catch (error) {
    console.error("Error updating user:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

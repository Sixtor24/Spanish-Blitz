// @ts-nocheck
import sql from "../../../utils/sql";
import { auth } from "@/auth";
import { sendEmail, premiumActivatedTemplate } from "../../../utils/email";

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
    const { role, is_premium, plan } = body;

    const targetRows = await sql`
      SELECT id, email, display_name, role, is_premium, plan
      FROM users WHERE id = ${id} LIMIT 1
    `;

    if (targetRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const previous = targetRows[0];

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

    // If plan provided, normalize is_premium from plan; otherwise accept explicit is_premium toggle
    if (plan !== undefined) {
      const premiumFlag = plan === "premium";
      updates.push(`plan = $${paramIndex}`);
      values.push(plan);
      paramIndex++;
      updates.push(`is_premium = $${paramIndex}`);
      values.push(premiumFlag);
      paramIndex++;
    } else if (is_premium !== undefined) {
      updates.push(`is_premium = $${paramIndex}`);
      values.push(is_premium);
      paramIndex++;

      // keep plan in sync when only is_premium is toggled
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

    const updated = rows[0];

    const becamePremium =
      (previous.plan !== "premium" || previous.is_premium !== true) &&
      (updated.plan === "premium" || updated.is_premium === true);

    if (becamePremium) {
      sendEmail({
        to: updated.email,
        subject: "¡Tu acceso Premium está activo!",
        html: premiumActivatedTemplate({ name: updated.display_name, email: updated.email }),
      });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Error updating user:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}

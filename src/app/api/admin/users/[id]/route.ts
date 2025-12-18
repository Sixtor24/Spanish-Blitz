import sql from "../../../utils/sql";
import { requireAdmin, getCurrentUser } from "@/lib/auth/require-auth";
import { withErrorHandler } from "@/lib/utils/error-handler";
import { sendEmail, premiumActivatedTemplate } from "../../../utils/email";
import type { ApiContext, UpdateUserAdminBody } from "@/lib/types/api.types";

// Update user role and premium status (admin only)
export const PATCH = withErrorHandler(async (request: Request, { params }: ApiContext) => {
  const session = await requireAdmin(sql);
  const currentAdmin = await getCurrentUser(sql, session);
  const currentAdminId = currentAdmin.id;
  const { id } = params;
  const body = await request.json() as UpdateUserAdminBody;
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
}, 'PATCH /api/admin/users/[id]');

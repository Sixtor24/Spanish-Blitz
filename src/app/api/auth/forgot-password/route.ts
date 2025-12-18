// @ts-nocheck
import { createHash, randomUUID } from 'node:crypto';
import { auth } from '@/auth';
import sql from '../../utils/sql';
import { appBaseUrl, resetPasswordTemplate, sendEmail } from '../../utils/email';

async function ensureResetTable() {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'password_reset_tokens'
      ) THEN
        CREATE TABLE password_reset_tokens (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash text NOT NULL UNIQUE,
          expires_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
      END IF;
    END$$;
  `;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return Response.json({ success: true }); // no user enumeration
    }

    await ensureResetTable();

    const rows = await sql`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;

    if (rows.length === 0) {
      return Response.json({ success: true });
    }

    const user = rows[0];

    // invalidate previous tokens for this user
    await sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`;

    const token = randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await sql`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
    `;

    const resetLink = `${appBaseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: user.email,
      subject: 'Restablece tu contraseña',
      html: resetPasswordTemplate({ resetLink }),
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in forgot password:', error);
    return Response.json({ success: true }); // avoid leaking info
  }
}

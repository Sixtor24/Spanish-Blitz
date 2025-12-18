import { neon } from '@neondatabase/serverless';
import { hash } from 'argon2';
import crypto from 'node:crypto';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const users = [
  {
    email: 'admin@blitz.dev',
    password: 'password',
    name: 'Admin',
    role: 'admin',
    plan: 'premium',
  },
  {
    email: 'premium@blitz.dev',
    password: 'password',
    name: 'Premium Tester',
    role: 'user',
    plan: 'premium',
  },
  {
    email: 'free@blitz.dev',
    password: 'password',
    name: 'Free Tester',
    role: 'user',
    plan: 'free',
  },
];

async function upsertUser(user) {
  const hashed = await hash(user.password);

  const existingUser = await sql`
    SELECT id FROM users WHERE email = ${user.email} LIMIT 1
  `;

  // Find existing auth user by email
  const existingAuth = await sql`
    SELECT id FROM auth_users WHERE email = ${user.email} LIMIT 1
  `;

  // Prefer existing auth id, then users id, else create new
  const authId = existingAuth[0]?.id ?? existingUser[0]?.id ?? crypto.randomUUID();

  const authUser = await sql`
    INSERT INTO auth_users (id, name, email, "emailVerified", image)
    VALUES (${authId}, ${user.name}, ${user.email}, NULL, NULL)
    ON CONFLICT (email) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email
    RETURNING id
  `;

  const resolvedAuthId = authUser[0].id;

  // Reset credentials account
  await sql`DELETE FROM auth_accounts WHERE "userId" = ${resolvedAuthId} AND provider = 'credentials'`;

  await sql`
    INSERT INTO auth_accounts (
      "userId", provider, type, "providerAccountId", access_token, expires_at,
      refresh_token, id_token, scope, session_state, token_type, password
    ) VALUES (
      ${resolvedAuthId}, 'credentials', 'credentials', ${resolvedAuthId}, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, ${hashed}
    )
  `;

  const isPremium = user.plan === 'premium';

  // Ensure users table row uses the resolved auth id; delete existing email row to avoid conflicts
  await sql`DELETE FROM users WHERE email = ${user.email}`;
  await sql`
    INSERT INTO users (id, email, display_name, role, is_premium, plan, created_at, updated_at)
    VALUES (${resolvedAuthId}, ${user.email}, ${user.name}, ${user.role}, ${isPremium}, ${user.plan}, now(), now())
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        display_name = EXCLUDED.display_name,
        role = EXCLUDED.role,
        is_premium = EXCLUDED.is_premium,
        plan = EXCLUDED.plan,
        updated_at = now()
  `;
}

async function main() {
  for (const user of users) {
    await upsertUser(user);
    console.log(`Seeded ${user.email} (${user.plan})`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

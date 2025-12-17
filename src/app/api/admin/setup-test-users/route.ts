// @ts-nocheck
import sql from "../../utils/sql";
import { hash } from "argon2";

// One-time setup endpoint to create test user credentials
export async function POST(request) {
  try {
    const testUsers = [
      {
        email: "admin@thespanishblitz.test",
        password: "Admin123!",
        displayName: "Test Admin",
        role: "admin",
        isPremium: true,
        plan: "premium",
      },
      {
        email: "teacher@thespanishblitz.test",
        password: "Teacher123!",
        displayName: "Test Teacher",
        role: "teacher",
        isPremium: false,
        plan: "free",
      },
      {
        email: "premium@thespanishblitz.test",
        password: "Premium123!",
        displayName: "Premium Student",
        role: "student",
        isPremium: true,
        plan: "premium",
      },
      {
        email: "free@thespanishblitz.test",
        password: "Free123!",
        displayName: "Free Student",
        role: "student",
        isPremium: false,
        plan: "free",
      },
    ];

    const results = [];

    for (const testUser of testUsers) {
      // Hash password
      const hashedPassword = await hash(testUser.password);

      // Check if auth_user exists, if not create it
      let authUserRows = await sql`
        SELECT id FROM auth_users WHERE email = ${testUser.email} LIMIT 1
      `;

      let authUserId;
      if (authUserRows.length === 0) {
        // Create auth_users entry
        const newAuthUserRows = await sql`
          INSERT INTO auth_users (email, name, "emailVerified", image)
          VALUES (${testUser.email}, ${testUser.displayName}, NOW(), NULL)
          RETURNING id
        `;
        authUserId = newAuthUserRows[0].id;
      } else {
        authUserId = authUserRows[0].id;
        // Update name if different
        await sql`
          UPDATE auth_users
          SET name = ${testUser.displayName}
          WHERE id = ${authUserId}
        `;
      }

      // Create or update auth_accounts with password
      await sql`
        INSERT INTO auth_accounts (type, provider, "providerAccountId", password, "userId")
        VALUES ('credentials', 'credentials', ${testUser.email}, ${hashedPassword}, ${authUserId})
        ON CONFLICT ("userId", provider, type)
        DO UPDATE SET password = ${hashedPassword}
      `;

      // Check if users entry exists, if not create it
      let userRows = await sql`
        SELECT id FROM users WHERE email = ${testUser.email} LIMIT 1
      `;

      if (userRows.length === 0) {
        // Create users entry with role and premium status
        await sql`
          INSERT INTO users (email, display_name, role, is_premium, plan)
          VALUES (${testUser.email}, ${testUser.displayName}, ${testUser.role}, ${testUser.isPremium}, ${testUser.plan})
        `;
      } else {
        // Update existing user with correct role and premium status
        await sql`
          UPDATE users
          SET display_name = ${testUser.displayName},
              role = ${testUser.role},
              is_premium = ${testUser.isPremium},
              plan = ${testUser.plan}
          WHERE email = ${testUser.email}
        `;
      }

      results.push({
        email: testUser.email,
        role: testUser.role,
        isPremium: testUser.isPremium,
        status: "success",
        message: "User created/updated with credentials",
      });
    }

    return Response.json({
      message: "Test users setup completed",
      results,
    });
  } catch (error) {
    console.error("Error setting up test users:", error);
    return Response.json(
      { error: "Failed to setup test users", details: error.message },
      { status: 500 },
    );
  }
}

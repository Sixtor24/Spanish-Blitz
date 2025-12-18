export async function GET() {
  const required = [
    'AUTH_SECRET',
    'DATABASE_URL',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'APP_BASE_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  return new Response(
    JSON.stringify({
      status: missing.length === 0 ? 'ok' : 'missing_env',
      missing,
      node: process.version,
      vercel: process.env.VERCEL ?? false,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      status: missing.length === 0 ? 200 : 500,
    }
  );
}

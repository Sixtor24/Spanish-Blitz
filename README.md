# The Spanish Blitz

## Run locally

```bash
npm run dev
```

Default ports:
- App: 4000 (React Router + Hono)
- WebSocket signals: 4001 (override with `WS_PORT` or set `VITE_WS_URL` on client)

Required env:
- `DATABASE_URL`
- `AUTH_SECRET`

## Seed test accounts

Uses credentials auth (email/password). Seed script will upsert both auth and app users.

```bash
# set DATABASE_URL first
node scripts/seed-users.mjs
```

Creates:
- admin@blitz.dev / password  (role: admin, plan: premium)
- premium@blitz.dev / password (role: user, plan: premium)
- free@blitz.dev / password    (role: user, plan: free)

## Blitz Challenge real-time
- WebSockets on `ws://localhost:4001` (or `VITE_WS_URL`).
- Client auto-subscribes per `sessionId` and refreshes on `session:refresh`; polling remains as fallback.

## Admin panel
- `/admin/users` (admin only): toggle plan Free/Premium and role user/admin; filtered search.

## Scoring model
- Blitz Challenge: +2 correct, -1 incorrect. Players auto-marcan (honor system). Host en modo profesor no responde.

## Flujo Blitz Challenge (profesor vs jugador)
- Crear (solo premium/admin): define `questionCount`, `timePerQuestion`, y marca "soy profesor" si el host será espectador. Se genera `code` y `sessionId`.
- Unirse: jugadores ingresan con código; el host en modo profesor no responde y sí ve respuestas correctas; los jugadores no ven respuestas.
- Juego: cada respuesta suma +2 o resta -1; timeout por pregunta según `timePerQuestion` (si se definió); se avanza cuando todos responden o se agota el tiempo.
- Cierre: ranking final por score (empates permitidos) y estado completado.

## QA manual rápido
1) Seed y arranque: exporta `DATABASE_URL` y `AUTH_SECRET`, corre `node scripts/seed-users.mjs`, luego `npm run dev` (usa 4000 o salta a 4001 si ocupado; WS mismo puerto).
2) Login: entra con `admin@blitz.dev` (pass `password`).
3) Crear reto: en Blitz Challenge create, marca "profesor" (si aplicar), selecciona preguntas/tiempo y copia el código.
4) Jugar: abre incógnito, login `free@blitz.dev` o `premium@blitz.dev`, únete con el código, responde y confirma scoring (+2/-1). El host en modo profesor no debe poder responder.
5) Real-time: al responder desde un jugador, la vista del profesor/otro jugador debe refrescar sin recargar (WS signal + fetch).
6) Final: verifica ranking final y que no se muestren respuestas a jugadores durante la partida.
7) Admin panel: en `/admin/users`, prueba toggles de plan y rol; confirma persistencia al refrescar.

## Notes
- If you run on a different host/port, set `VITE_WS_URL` (e.g. `wss://yourhost:443/ws`).
- Lint/tests not wired in scripts; run `npm run typecheck` if needed.

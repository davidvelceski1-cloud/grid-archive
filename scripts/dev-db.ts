/**
 * OPTIONAL zero-install local database for development: runs PGlite (Postgres
 * compiled to WASM, with pgvector) and exposes it on a local TCP port so
 * Prisma can connect. Production should use Neon/Supabase.
 *
 *   npm run dev:db       # keep running in its own terminal
 *   DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/postgres?sslmode=disable&connection_limit=1&pgbouncer=true"
 *
 * PGlite is a single session shared by every client, hence connection_limit=1 and
 * pgbouncer=true (disables Prisma's named prepared statements, which would collide).
 */
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.DEV_DB_PORT ?? 5433);

async function main() {
  const db = await PGlite.create({ dataDir: process.env.DEV_DB_DIR ?? "./.devdb", extensions: { vector } });
  await db.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  // The built-in multiplexer lets several clients (e.g. Next.js build workers) share the one PGlite session.
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 10 });
  await server.start();
  console.log(`PGlite dev database listening on 127.0.0.1:${port}`);
  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

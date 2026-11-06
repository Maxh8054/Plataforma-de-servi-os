// Sonda de conexão: acha o host alcançável do PostgreSQL real do Render.
// Recebe PGUSER/PGPASSWORD/PGDATABASE por env (nunca imprime a senha).
// Uso: PGUSER=... PGPASSWORD=... PGDATABASE=... node scripts/probe-pg-host.mjs
import pg from "pg";
import dns from "node:dns/promises";

const SUFIXOS = [
  "", // hostname exatamente como foi passado (interno do Render)
  ".oregon-postgres.render.com",
  ".sao-paulo-postgres.render.com",
  ".frankfurt-postgres.render.com",
  ".ohio-postgres.render.com",
  ".virginia-postgres.render.com",
  ".singapore-postgres.render.com",
];

const HOST_BASE = process.env.PG_HOST_BASE; // ex.: dpg-d6h0d4ma2pns7388dgq0-a

for (const suf of SUFIXOS) {
  const host = HOST_BASE + suf;
  try {
    const ips = await dns.resolve4(host).catch(() => null);
    if (!ips) { console.log(`DNS  falhou : ${host}`); continue; }
    const c = new pg.Client({
      host, user: process.env.PGUSER, password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE, ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await c.connect();
      const v = await c.query("select version() as v, current_database() as db");
      console.log(`OK         : ${host}`);
      console.log(`versão     : ${v.rows[0].v.split(",")[0]}`);
      console.log(`banco      : ${v.rows[0].db}`);
      await c.end();
      console.log(`HOST_OK=${host}`);
      process.exit(0);
    } catch (e) {
      console.log(`TCP ok mas Postgres recusou : ${host} → ${e.message.slice(0, 80)}`);
      try { await c.end(); } catch {}
    }
  } catch (e) {
    console.log(`erro       : ${host} → ${e.message.slice(0, 80)}`);
  }
}
console.log("NENHUM host respondeu.");
process.exit(1);

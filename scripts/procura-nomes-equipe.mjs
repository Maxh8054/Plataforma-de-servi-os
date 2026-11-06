// Procura os nomes EXATOS de Marcos Paulo, Wesley, Higor, Marcelo no banco REAL
// (aniversarios + tabela de usuários/logins) para acertar a escala A/B/C/D.
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL_PG,
  ssl: { rejectUnauthorized: false },
});

const norm = (v) =>
  String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function main() {
  await c.connect();

  // 1) aniversarios goias
  const ani = await c.query(`select data from tv_sections where "panelSlug"='goias' and "sectionKey"='aniversarios'`);
  if (ani.rows.length) {
    const itens = JSON.parse(ani.rows[0].data).itens || [];
    const alvo = itens.filter((x) => /marcos|wesl|higor|marcelo/i.test(x.nome || ""));
    console.log("=== aniversarios goias (candidatos) ===");
    for (const x of alvo) console.log(`- ${JSON.stringify(x.nome)}  foto=${x.foto ? "SIM(" + x.foto.slice(0, 40) + "...)" : "não"}`);
  }

  // 2) tabelas do banco (procura usuários/logins)
  const tabs = await c.query(`select table_name from information_schema.tables where table_schema='public' order by 1`);
  const nomes = tabs.rows.map((r) => r.table_name);
  console.log("\n=== tabelas ===\n" + nomes.join(", "));

  for (const t of ["users", "usuarios", "user", "colaboradores", "colaborador", "funcionarios", "User"]) {
    if (!nomes.includes(t)) continue;
    const cols = await c.query(`select column_name from information_schema.columns where table_name=$1`, [t]);
    const colNames = cols.rows.map((r) => r.column_name);
    const nomeCol = colNames.find((x) => /nome|name/i.test(x));
    if (!nomeCol) continue;
    const rows = await c.query(`select * from "${t}"`);
    console.log(`\n=== ${t} (${colNames.join(", ")}) — nomes que interessam ===`);
    for (const r of rows.rows) {
      const n = r[nomeCol] || "";
      if (/marcos|wesl|wesl|higor|marcelo/i.test(n)) console.log(`- ${JSON.stringify(n)} | campos: ` + JSON.stringify({...r, [nomeCol]: undefined}).slice(0, 200));
    }
  }
}
main()
  .catch((e) => { console.error("ERRO:", e.message); process.exitCode = 1; })
  .finally(() => c.end());

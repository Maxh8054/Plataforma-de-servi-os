// Inspeciona o banco REAL: seções do painel goias + fotos dos técnicos da escala.
// Uso: DATABASE_URL_PG='postgresql://...' node scripts/inspeciona-real.mjs
import pg from "pg";

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL_PG,
  ssl: { rejectUnauthorized: false },
});

const norm = (v) =>
  String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const TECNICOS = ["marcos paulo moraes borges", "weslley ferreira de siqueira", "higor ataides macedo", "marcelo goncalves de paula"];

async function main() {
  await c.connect();

  const secs = await c.query(
    `select "sectionKey", length(data) bytes, "atualizadoPorNome", "atualizadoEm"
     from tv_sections where "panelSlug"='goias' order by "sectionKey"`
  );
  console.log("=== seções goias no banco REAL ===");
  for (const r of secs.rows) console.log(`${r.sectionKey.padEnd(18)} ${String(r.bytes).padStart(6)}b  por ${r.atualizadoPorNome ?? "-"} em ${r.atualizadoEm?.toISOString?.().slice(0,16) ?? "-"}`);

  // aniversarios: quem tem foto?
  const ani = await c.query(`select data from tv_sections where "panelSlug"='goias' and "sectionKey"='aniversarios'`);
  if (!ani.rows.length) {
    console.log("\naniversarios: NÃO EXISTE no banco real — nenhum técnico tem foto ainda.");
  } else {
    const j = JSON.parse(ani.rows[0].data);
    const itens = j.itens || [];
    const comFoto = itens.filter((x) => x.foto);
    console.log(`\naniversarios: ${itens.length} pessoas, ${comFoto.length} com foto`);
    const mapa = new Map(itens.map((x) => [norm(x.nome), x]));
    console.log("\n=== técnicos da escala × cadastro ===");
    for (const t of TECNICOS) {
      const p = mapa.get(t);
      const varia = itens.filter((x) => norm(x.nome).includes(t.split(" ")[0]));
      if (p) console.log(`${t.padEnd(16)} → CADASTRADO${p.foto ? " COM FOTO ✓" : " sem foto"}`);
      else if (varia.length) console.log(`${t.padEnd(16)} → parecidos: ${varia.map((x) => x.nome + (x.foto ? " (com foto)" : " (sem foto)")).join(", ")}`);
      else console.log(`${t.padEnd(16)} → não está no cadastro`);
    }
  }

  // escala manual salva?
  const esc = await c.query(`select data from tv_sections where "panelSlug"='goias' and "sectionKey"='escala'`);
  if (esc.rows.length) {
    const j = JSON.parse(esc.rows[0].data);
    console.log(`\nescala (aba): horarios.auto=${j?.horarios?.auto ?? "?"}, dias lançados=${(j?.dias || []).length}`);
  } else {
    console.log("\nescala (aba): sem linha — TV usa o modo automático se ligado na aba");
  }
}
main()
  .catch((e) => { console.error("ERRO:", e.message); process.exitCode = 1; })
  .finally(() => c.end());

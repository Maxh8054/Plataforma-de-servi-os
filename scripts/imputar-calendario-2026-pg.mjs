// Imputação no BANCO REAL (PostgreSQL do Render): Calendário Goiás 2026
// Aba "calendario" do Painel TV — tv_sections (panelSlug="goias")
// Fonte: upload/"Pasted Content_1793817180565.txt" (FERIADOS[2026]) — sem nenhuma alteração.
// Uso: DATABASE_URL_PG='postgresql://...' node scripts/imputar-calendario-2026-pg.mjs
import pg from "pg";

const ANO = 2026;
const PAINEL = "goias";

// ===== Lista EXATA do exemplo anexado (ordem e nomes idênticos) =====
const FERIADOS_2026 = [
  ["01-01", "F", "Ano Novo"],
  ["01-02", "P", "Ponte"],
  ["01-16", "F", "Aniversário de Alto Horizonte"],
  ["01-19", "F", "Padroeira de Alto Horizonte"],
  ["02-16", "P", "Ponte de Carnaval"],
  ["02-17", "F", "Carnaval"],
  ["04-03", "F", "Sexta-feira Santa"],
  ["04-20", "P", "Ponte"],
  ["04-21", "F", "Tiradentes"],
  ["05-01", "F", "Dia do Trabalhador"],
  ["06-04", "F", "Corpus Christi"],
  ["06-05", "P", "Ponte"],
  ["09-07", "F", "Independência do Brasil"],
  ["09-30", "F", "Dia do Evangélico"],
  ["10-12", "F", "Nossa Senhora Aparecida"],
  ["11-02", "F", "Finados"],
  ["11-15", "F", "Proclamação da República"],
  ["11-20", "F", "Consciência Negra"],
  ["12-23", "P", "Ponte de Natal"],
  ["12-24", "P", "Ponte de Natal"],
  ["12-25", "F", "Natal"],
  ["12-30", "P", "Ponte de Ano Novo"],
  ["12-31", "P", "Ponte de Ano Novo"],
];
const tipoDe = (f) => (f === "F" ? "Feriado" : f === "P" ? "Ponte" : null);
const ITENS = FERIADOS_2026.map(([md, f, nome]) => ({ data: `${ANO}-${md}`, tipo: tipoDe(f), nome }));
const ESPERADO = FERIADOS_2026.map(([md, f, nome]) => `${ANO}-${md}|${f}|${nome}`);

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL_PG,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await c.connect();

  // 0) estrutura real da tabela (nomes de colunas conforme o @map do Prisma)
  const cols = await c.query(
    `select column_name from information_schema.columns where table_name='tv_sections' order by ordinal_position`
  );
  const colNames = cols.rows.map((r) => r.column_name);
  console.log("Colunas reais de tv_sections:", colNames.join(", "));
  const tem = (n) => colNames.includes(n);

  // 1) contexto: o que já existe no banco real
  const todas = await c.query(`select "panelSlug", count(*) n, sum(length(data)) bytes from tv_sections group by "panelSlug" order by "panelSlug"`);
  console.log("\n=== tv_sections no banco REAL (por painel) ===");
  console.table(todas.rows);

  // 2) estado ANTES da linha alvo (para reportar/comparar)
  const antes = await c.query(
    `select data, "atualizadoPorNome", "atualizadoEm" from tv_sections where "panelSlug"=$1 and "sectionKey"=$2`,
    [PAINEL, "calendario"]
  );
  if (antes.rows.length) {
    const a = antes.rows[0];
    const j = (() => { try { return JSON.parse(a.data); } catch { return null; } })();
    console.log(`\nJÁ EXISTIA: goias/calendario (${(j?.itens || []).length} itens, atualizado por ${a.atualizadoPorNome ?? "-"} em ${a.atualizadoEm ?? "-"}) — será atualizado com a lista oficial 2026.`);
  } else {
    console.log("\nNão existia linha goias/calendario — será criada agora.");
  }

  // 3) admin da plataforma real (registro de "atualizado por")
  //    (o banco real usa role 'admin' minúsculo; aceito ambos)
  const admin = await c.query(
    `select id, name from "User" where lower(role)='admin' and "isActive"=true order by "createdAt" asc limit 1`
  );
  const adminId = admin.rows[0]?.id ?? null;
  const adminNome = admin.rows[0]?.name ?? null;

  // 4) Gravação idempotente: existe → UPDATE; não existe → INSERT com id gerado
  //    (o Prisma gera o id no client; no SQL puro preciso fornecer).
  const payload = JSON.stringify({ itens: ITENS });
  const existe = antes.rows.length > 0;
  if (existe) {
    await c.query(
      `update tv_sections set
         "data"=$3, "pendingData"=null, "pendingEm"=null, "pendingPorId"=null, "pendingPorNome"=null,
         "atualizadoEm"=now(), "atualizadoPorId"=$4, "atualizadoPorNome"=$5${tem("updatedAt") ? ', "updatedAt"=now()' : ""}
       where "panelSlug"=$1 and "sectionKey"=$2`,
      [PAINEL, "calendario", payload, adminId, adminNome]
    );
  } else {
    const novoId = tem("id") ? "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12) : null;
    await c.query(
      `insert into tv_sections ("id","panelSlug","sectionKey","data","atualizadoEm","atualizadoPorId","atualizadoPorNome","pendingData","pendingEm","pendingPorId","pendingPorNome"${tem("createdAt") ? ',"createdAt"' : ""}${tem("updatedAt") ? ',"updatedAt"' : ""})
       values ($6,$1,$2,$3,now(),$4,$5,null,null,null,null${tem("createdAt") ? ",now()" : ""}${tem("updatedAt") ? ",now()" : ""})`,
      [PAINEL, "calendario", payload, adminId, adminNome, novoId]
    );
  }

  // 5) verificação: reler do banco real e comparar item a item com o exemplo
  const depois = await c.query(
    `select data, "atualizadoPorNome", "atualizadoEm" from tv_sections where "panelSlug"=$1 and "sectionKey"=$2`,
    [PAINEL, "calendario"]
  );
  const relido = JSON.parse(depois.rows[0].data);
  const obtido = relido.itens.map((x) => {
    const f = x.tipo === "Feriado" ? "F" : x.tipo === "Ponte" ? "P" : x.tipo;
    return `${x.data}|${f}|${x.nome}`;
  });
  let difs = 0;
  for (let i = 0; i < Math.max(ESPERADO.length, obtido.length); i++) {
    if (ESPERADO[i] !== obtido[i]) { difs++; console.log(`DIF ${i + 1}: esperado [${ESPERADO[i]}] ≠ banco [${obtido[i]}]`); }
  }
  console.log(`\n=== GRAVADO NO BANCO REAL: ${PAINEL}/calendario ===`);
  console.log(`Itens: ${relido.itens.length} | exemplo: ${FERIADOS_2026.length} | diferenças: ${difs}`);
  console.log(`Atualizado por: ${depois.rows[0].atualizadoPorNome ?? "-"} em ${depois.rows[0].atualizadoEm}`);
  if (difs > 0 || relido.itens.length !== FERIADOS_2026.length) {
    console.error("FALHA: banco real não ficou idêntico ao exemplo.");
    process.exitCode = 1;
  } else {
    console.log("OK: banco REAL idêntico ao exemplo anexado, sem nenhuma alteração.");
  }
}

main()
  .catch((e) => { console.error("ERRO:", e.message); process.exitCode = 1; })
  .finally(() => c.end());

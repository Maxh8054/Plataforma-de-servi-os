// Imputação no banco: Calendário Goiás 2026 (aba "calendario" do Painel TV)
// Fonte: /home/z/my-project/upload/"Pasted Content_1793817180565.txt" (FERIADOS[2026])
// Formato no banco: tv_sections { panelSlug:"goias", sectionKey:"calendario",
//   data: {"itens":[{data:"2026-MM-DD", tipo:"Feriado"|"Ponte", nome:"..."}]} }
// NADA é alterado: cada linha do exemplo vira 1 item, na mesma ordem.
import { PrismaClient } from "@prisma/client";

const ANO = 2026;
const PAINEL = "goias"; // o exemplo é o "Calendário Goiás"

// ===== Lista EXATA do exemplo anexado (ordem e nomes idênticos) =====
// [MM-DD, "F"=Feriado | "P"=Ponte, nome]
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
const itens = FERIADOS_2026.map(([md, f, nome]) => ({
  data: `${ANO}-${md}`,
  tipo: tipoDe(f),
  nome,
}));

const db = new PrismaClient();

async function main() {
  // quem fica registrado como responsável pela imputação = admin da plataforma
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const payload = JSON.stringify({ itens });

  await db.tvSection.upsert({
    where: { panelSlug_sectionKey: { panelSlug: PAINEL, sectionKey: "calendario" } },
    create: {
      panelSlug: PAINEL,
      sectionKey: "calendario",
      data: payload,
      atualizadoEm: new Date(),
      atualizadoPorId: admin?.id ?? null,
      atualizadoPorNome: admin?.name ?? null,
    },
    update: {
      data: payload,
      pendingData: null, // conteúdo oficial direto no ar; limpa pendência antiga se houver
      pendingEm: null,
      pendingPorId: null,
      pendingPorNome: null,
      atualizadoEm: new Date(),
      atualizadoPorId: admin?.id ?? null,
      atualizadoPorNome: admin?.name ?? null,
    },
  });

  // ===== Verificação: reler do banco e conferir item a item contra o exemplo =====
  const salvo = await db.tvSection.findUnique({
    where: { panelSlug_sectionKey: { panelSlug: PAINEL, sectionKey: "calendario" } },
  });
  const relido = JSON.parse(salvo.data);

  const esperado = FERIADOS_2026.map(([md, f, nome]) => `${ANO}-${md}|${f}|${nome}`);
  const obtido = relido.itens.map((x) => {
    const f = x.tipo === "Feriado" ? "F" : x.tipo === "Ponte" ? "P" : x.tipo;
    return `${x.data}|${f}|${x.nome}`;
  });

  let difs = 0;
  const n = Math.max(esperado.length, obtido.length);
  for (let i = 0; i < n; i++) {
    if (esperado[i] !== obtido[i]) {
      difs++;
      console.log(`DIF linha ${i + 1}: esperado [${esperado[i]}] ≠ banco [${obtido[i]}]`);
    }
  }

  console.log(`\n=== GRAVADO: tv_sections → painel "${PAINEL}" / aba "calendario" ===`);
  console.log(`Itens gravados: ${relido.itens.length} | Itens no exemplo: ${FERIADOS_2026.length} | Diferenças: ${difs}`);
  console.log(`Atualizado por: ${salvo.atualizadoPorNome ?? "-"} em ${salvo.atualizadoEm?.toISOString()}`);
  console.table(
    relido.itens.map((x) => ({ data: x.data, tipo: x.tipo, nome: x.nome }))
  );
  if (difs > 0 || relido.itens.length !== FERIADOS_2026.length) {
    console.error("FALHA: o banco não ficou idêntico ao exemplo.");
    process.exit(1);
  }
  console.log("OK: banco idêntico ao exemplo anexado, sem nenhuma alteração.");
}

main()
  .catch((e) => {
    console.error("ERRO:", e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

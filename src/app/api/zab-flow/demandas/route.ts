import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const demandas = await db.zabDemanda.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ demandas });
  } catch (error) {
    console.error("Error fetching demandas:", error);
    return NextResponse.json({ demandas: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Generate tag
    const count = await db.zabDemanda.count();
    const tag = `ZAB-${String(count + 1).padStart(3, "0")}`;

    const demanda = await db.zabDemanda.create({
      data: {
        funcionarioId: body.funcionarioId || 1,
        nomeFuncionario: body.nomeFuncionario || "",
        emailFuncionario: body.emailFuncionario || "",
        categoria: body.categoria || "",
        prioridade: body.prioridade || "Média",
        complexidade: body.complexidade || "Médio",
        descricao: body.descricao || "",
        local: body.local || "Lundin",
        dataLimite: body.dataLimite || "",
        status: "pendente",
        isRotina: body.isRotina || 0,
        diasSemana: body.diasSemana || null,
        tag: tag,
        comentarios: "",
        comentarioGestor: "",
        atribuidos: "[]",
      },
    });

    // Create audit entry
    await db.zabAudit.create({
      data: {
        acao: "CREATE",
        tabela: "zab_demandas",
        registroId: demanda.id,
        dadosNovos: JSON.stringify(demanda),
        dataHora: new Date().toISOString(),
      },
    });

    return NextResponse.json({ demanda }, { status: 201 });
  } catch (error) {
    console.error("Error creating demanda:", error);
    return NextResponse.json({ error: "Failed to create demanda" }, { status: 500 });
  }
}

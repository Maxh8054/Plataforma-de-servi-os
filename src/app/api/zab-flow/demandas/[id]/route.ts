import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const demandaId = parseInt(id);

    // Get old data for audit
    const oldDemanda = await db.zabDemanda.findUnique({ where: { id: demandaId } });

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.comentarios !== undefined) updateData.comentarios = body.comentarios;
    if (body.comentarioGestor !== undefined) updateData.comentarioGestor = body.comentarioGestor;
    if (body.prioridade) updateData.prioridade = body.prioridade;
    if (body.complexidade) updateData.complexidade = body.complexidade;
    if (body.atribuidos) updateData.atribuidos = body.atribuidos;
    if (body.dataLimite) updateData.dataLimite = body.dataLimite;

    if (body.status === "concluída") {
      updateData.dataConclusao = new Date().toISOString();
    }

    const demanda = await db.zabDemanda.update({
      where: { id: demandaId },
      data: updateData,
    });

    // Create audit entry
    await db.zabAudit.create({
      data: {
        acao: "UPDATE",
        tabela: "zab_demandas",
        registroId: demandaId,
        dadosAntigos: oldDemanda ? JSON.stringify(oldDemanda) : null,
        dadosNovos: JSON.stringify(demanda),
        dataHora: new Date().toISOString(),
      },
    });

    return NextResponse.json({ demanda });
  } catch (error) {
    console.error("Error updating demanda:", error);
    return NextResponse.json({ error: "Failed to update demanda" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const demandaId = parseInt(id);

    const oldDemanda = await db.zabDemanda.findUnique({ where: { id: demandaId } });

    await db.zabDemanda.delete({ where: { id: demandaId } });

    await db.zabAudit.create({
      data: {
        acao: "DELETE",
        tabela: "zab_demandas",
        registroId: demandaId,
        dadosAntigos: oldDemanda ? JSON.stringify(oldDemanda) : null,
        dataHora: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting demanda:", error);
    return NextResponse.json({ error: "Failed to delete demanda" }, { status: 500 });
  }
}

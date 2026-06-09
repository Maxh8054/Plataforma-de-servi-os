import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const audit = await db.zabAudit.create({
      data: {
        acao: "CREATE",
        tabela: "epi_audit",
        registroId: 0,
        dadosNovos: JSON.stringify({
          employeeName: body.employeeName,
          equipmentType: body.equipmentType,
          status: body.status,
          observations: body.observations,
          auditor: body.auditor,
          date: body.date,
        }),
        dataHora: new Date().toISOString(),
      },
    });
    return NextResponse.json({ audit }, { status: 201 });
  } catch (error) {
    console.error("Error creating EPI audit:", error);
    return NextResponse.json({ error: "Failed to create audit" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const usuarios = await db.zabUsuario.findMany({
      orderBy: { nome: "asc" },
    });
    // Don't return passwords in the list
    const safeUsuarios = usuarios.map(({ senha, ...rest }) => rest);
    return NextResponse.json({ usuarios: safeUsuarios });
  } catch (error) {
    console.error("Error fetching usuarios:", error);
    return NextResponse.json({ usuarios: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const usuario = await db.zabUsuario.create({
      data: {
        nome: body.nome || "",
        email: body.email || "",
        senha: body.senha || "2026",
        nivel: body.nivel || "Junior",
        pontos: 0,
        conquistas: "[]",
        role: body.role || "funcionario",
      },
    });

    // Create audit entry
    await db.zabAudit.create({
      data: {
        acao: "CREATE",
        tabela: "zab_usuarios",
        registroId: usuario.id,
        dadosNovos: JSON.stringify({ nome: usuario.nome, email: usuario.email, nivel: usuario.nivel, role: usuario.role }),
        dataHora: new Date().toISOString(),
      },
    });

    const { senha, ...safeUsuario } = usuario;
    return NextResponse.json({ usuario: safeUsuario }, { status: 201 });
  } catch (error) {
    console.error("Error creating usuario:", error);
    return NextResponse.json({ error: "Failed to create usuario" }, { status: 500 });
  }
}

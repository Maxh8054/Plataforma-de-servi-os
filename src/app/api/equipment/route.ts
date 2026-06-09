import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const equipment = await db.equipment.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ equipment });
  } catch (error) {
    console.error("Error fetching equipment:", error);
    return NextResponse.json({ equipment: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const equipment = await db.equipment.create({
      data: {
        equipamento: body.equipamento || "",
        modelo: body.modelo || "",
        cliente: body.cliente || "",
        size: body.size || "",
        local: body.local || "",
        empresa: body.empresa || "",
        ano: body.ano || "",
        statusOperacao: body.statusOperacao || null,
        motivoStandby: body.motivoStandby || null,
        falhasCriticas: body.falhasCriticas || null,
      },
    });
    return NextResponse.json({ equipment }, { status: 201 });
  } catch (error) {
    console.error("Error creating equipment:", error);
    return NextResponse.json({ error: "Failed to create equipment" }, { status: 500 });
  }
}

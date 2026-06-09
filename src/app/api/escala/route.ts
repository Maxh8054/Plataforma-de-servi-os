import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const escala = await db.escalaData.findUnique({ where: { id: 1 } });
    return NextResponse.json({ dados: escala?.dados || "{}" });
  } catch (error) {
    console.error("Error fetching escala:", error);
    return NextResponse.json({ dados: "{}" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const escala = await db.escalaData.upsert({
      where: { id: 1 },
      update: { dados: body.dados },
      create: { id: 1, dados: body.dados },
    });
    return NextResponse.json({ escala });
  } catch (error) {
    console.error("Error saving escala:", error);
    return NextResponse.json({ error: "Failed to save escala" }, { status: 500 });
  }
}

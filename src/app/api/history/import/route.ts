import { NextResponse } from 'next/server';

// History Import API - Disabled
export async function POST() {
  return NextResponse.json({ success: true, message: 'History import disabled', imported: 0, updated: 0, skipped: 0, total: 0 });
}
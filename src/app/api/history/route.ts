import { NextResponse } from 'next/server';

// History API - Disabled
// All endpoints return empty responses

// GET - Returns empty
export async function GET() {
  return NextResponse.json({ reports: [] });
}

// POST - Returns empty success
export async function POST() {
  return NextResponse.json({ success: true, message: 'History disabled' });
}

// DELETE - Returns empty success
export async function DELETE() {
  return NextResponse.json({ success: true, message: 'History disabled' });
}
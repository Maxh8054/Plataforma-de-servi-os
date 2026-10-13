import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { PREDEFINED_USERS } from '@/lib/reports-auth';

export async function POST(request: NextRequest) {
  try {
    const { email, currentPassword } = await request.json();

    if (!email || !currentPassword) {
      return NextResponse.json({ valid: false, error: 'Missing fields' }, { status: 400 });
    }

    // Check predefined users first
    const predefinedUser = PREDEFINED_USERS.find(
      (u) => u.email === email && u.password === currentPassword
    );

    if (predefinedUser) {
      return NextResponse.json({ valid: true });
    }

    // Check database
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return NextResponse.json({ valid: false, error: 'User not found' }, { status: 404 });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return NextResponse.json({ valid: false, error: 'Incorrect password' }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json({ valid: false, error: 'Internal server error' }, { status: 500 });
  }
}

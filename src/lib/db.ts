import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? [] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Ensure all tables exist (fallback if prisma db push failed)
// Uses raw SQLite CREATE TABLE IF NOT EXISTS
export async function ensureTables() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS estoque_goias (
        id INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
        pecas TEXT NOT NULL DEFAULT '{}',
        retiradas TEXT NOT NULL DEFAULT '[]',
        pesquisas TEXT NOT NULL DEFAULT '[]',
        logins TEXT NOT NULL DEFAULT '[]'
      )
    `);
  } catch (e) {
    // Table might already exist, that's fine
  }
}
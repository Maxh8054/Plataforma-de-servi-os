import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'fs'
import { dirname } from 'path'

// ─── Ensure the database directory exists BEFORE Prisma connects ───
// This is critical for Render/Docker where the directory may not exist at startup.
function ensureDbDirectory() {
  try {
    const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
    // Parse "file:/app/db/custom.db" → "/app/db/custom.db"
    // Parse "file:./db/custom.db"    → "./db/custom.db"
    const filePath = dbUrl.replace(/^file:/, '')
    const dir = dirname(filePath)
    mkdirSync(dir, { recursive: true })
    console.log(`[db] Database directory ensured: ${dir}`)
  } catch (err) {
    console.error('[db] Failed to create database directory:', err)
  }
}

// Run synchronously at module load time
ensureDbDirectory()

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
    // Double-check directory exists (in case module load was before container fully ready)
    const dbUrl = process.env.DATABASE_URL || 'file:./db/custom.db'
    const filePath = dbUrl.replace(/^file:/, '')
    const dir = dirname(filePath)
    mkdirSync(dir, { recursive: true })
  } catch (e) {
    // Ignore
  }

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
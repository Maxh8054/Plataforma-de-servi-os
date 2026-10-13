import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Gerar ID único simples
function generateId(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Interface para sessões
interface SessionUpdate {
  userId: string;
  type: 'full' | 'field';
  data?: any;
  field?: string;
  value?: any;
  timestamp: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, sessionId, userId, data, type, field, value, timestamp, lastUpdate, initialData } = body;

    switch (action) {
      case 'create': {
        // Criar nova sessão
        const newSessionId = generateId(8);
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
          ? `https://${process.env.NEXTAUTH_URL || process.env.VERCEL_URL}` 
          : '';
        const shareLink = `${baseUrl}/report/${newSessionId}`;

        // Salvar no banco de dados como SharedSession
        await db.sharedSession.create({
          data: {
            sessionId: newSessionId,
            creatorId: userId || 'collaboration',
            creatorName: 'Collaboration Session',
            reportType: 'collaboration',
            permission: 'edit',
            data: JSON.stringify({
              data: data || null,
              users: {},
              updates: [],
              lastUpdated: Date.now(),
            }),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
          },
        });

        console.log(`[Collaboration] Created session ${newSessionId}`);

        return NextResponse.json({
          success: true,
          sessionId: newSessionId,
          shareLink,
        });
      }

      case 'join': {
        // Entrar na sessão
        const session = await db.sharedSession.findUnique({
          where: { sessionId },
        });

        if (!session) {
          return NextResponse.json({
            success: false,
            error: 'Session not found',
          }, { status: 404 });
        }

        // Parse session data
        const sessionData = JSON.parse(session.data || '{}');
        
        // Adicionar usuário
        if (!sessionData.users) sessionData.users = {};
        sessionData.users[userId] = {
          id: userId,
          joinedAt: Date.now(),
          lastSeen: Date.now(),
        };

        // Se tem dados iniciais, atualizar
        if (initialData) {
          sessionData.data = initialData;
          sessionData.lastUpdated = Date.now();
        }

        // Salvar no banco
        await db.sharedSession.update({
          where: { sessionId },
          data: {
            data: JSON.stringify(sessionData),
          },
        });

        const userCount = Object.keys(sessionData.users).length;

        return NextResponse.json({
          success: true,
          sessionId: session.sessionId,
          data: sessionData.data,
          userCount,
        });
      }

      case 'leave': {
        // Sair da sessão
        const session = await db.sharedSession.findUnique({
          where: { sessionId },
        });

        if (session && userId) {
          const sessionData = JSON.parse(session.data || '{}');
          if (sessionData.users && sessionData.users[userId]) {
            delete sessionData.users[userId];
            await db.sharedSession.update({
              where: { sessionId },
              data: { data: JSON.stringify(sessionData) },
            });
          }
        }

        return NextResponse.json({
          success: true,
        });
      }

      case 'poll': {
        // Polling para atualizações
        const session = await db.sharedSession.findUnique({
          where: { sessionId },
        });

        if (!session) {
          return NextResponse.json({
            success: false,
            error: 'Session not found',
          }, { status: 404 });
        }

        const sessionData = JSON.parse(session.data || '{}');

        // Atualizar lastSeen do usuário
        if (userId && sessionData.users && sessionData.users[userId]) {
          sessionData.users[userId].lastSeen = Date.now();
        }

        // Limpar usuários inativos (mais de 5 minutos)
        const now = Date.now();
        const maxInactive = 5 * 60 * 1000;
        if (sessionData.users) {
          Object.keys(sessionData.users).forEach((id: string) => {
            if (now - sessionData.users[id].lastSeen > maxInactive) {
              delete sessionData.users[id];
            }
          });
        }

        // Limpar atualizações antigas (mais de 5 minutos)
        if (sessionData.updates) {
          sessionData.updates = sessionData.updates.filter((u: SessionUpdate) => now - u.timestamp < maxInactive);
        }

        // Filtrar atualizações desde o último timestamp
        const newUpdates = (sessionData.updates || []).filter((u: SessionUpdate) => u.timestamp > (lastUpdate || 0));

        // Salvar alterações
        await db.sharedSession.update({
          where: { sessionId },
          data: { data: JSON.stringify(sessionData) },
        });

        const userCount = Object.keys(sessionData.users || {}).length;

        return NextResponse.json({
          success: true,
          updates: newUpdates,
          userCount,
          timestamp: Date.now(),
        });
      }

      case 'update': {
        // Enviar atualização
        const session = await db.sharedSession.findUnique({
          where: { sessionId },
        });

        if (!session) {
          return NextResponse.json({
            success: false,
            error: 'Session not found',
          }, { status: 404 });
        }

        const sessionData = JSON.parse(session.data || '{}');

        const update: SessionUpdate = {
          userId,
          type: type || 'full',
          timestamp: timestamp || Date.now(),
        };

        if (type === 'field') {
          update.field = field;
          update.value = value;
        } else {
          update.data = data;
          // Atualizar dados da sessão
          sessionData.data = data;
        }

        if (!sessionData.updates) sessionData.updates = [];
        sessionData.updates.push(update);
        sessionData.lastUpdated = Date.now();

        // Limpar atualizações antigas
        const now = Date.now();
        sessionData.updates = sessionData.updates.filter((u: SessionUpdate) => now - u.timestamp < 5 * 60 * 1000);

        // Salvar no banco
        await db.sharedSession.update({
          where: { sessionId },
          data: { data: JSON.stringify(sessionData) },
        });

        return NextResponse.json({
          success: true,
        });
      }

      case 'get': {
        // Obter dados da sessão
        const session = await db.sharedSession.findUnique({
          where: { sessionId },
        });

        console.log(`[Collaboration] Get session ${sessionId}, found: ${!!session}`);

        if (!session) {
          return NextResponse.json({
            success: false,
            error: 'Session not found',
          }, { status: 404 });
        }

        const sessionData = JSON.parse(session.data || '{}');
        const userCount = Object.keys(sessionData.users || {}).length;

        return NextResponse.json({
          success: true,
          data: sessionData.data,
          userCount,
          sessionId: session.sessionId,
        });
      }

      case 'delete': {
        // Deletar sessão
        await db.sharedSession.delete({
          where: { sessionId },
        }).catch(() => {}); // Ignorar se não existir

        return NextResponse.json({
          success: true,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Collaboration API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({
      success: false,
      error: 'Session ID required',
    }, { status: 400 });
  }

  const session = await db.sharedSession.findUnique({
    where: { sessionId },
  });

  if (!session) {
    return NextResponse.json({
      success: false,
      exists: false,
    });
  }

  const sessionData = JSON.parse(session.data || '{}');

  return NextResponse.json({
    success: true,
    exists: true,
    createdAt: session.createdAt.getTime(),
    lastUpdated: sessionData.lastUpdated || session.updatedAt.getTime(),
    userCount: Object.keys(sessionData.users || {}).length,
  });
}

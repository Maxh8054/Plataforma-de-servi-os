import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';

const secret = process.env.NEXTAUTH_SECRET || 'development-secret-key-z-services-ai-2024';

// Gerar ID único para sessão
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// POST - Criar nova sessão compartilhada OU salvar no histórico
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret,
      cookieName: 'next-auth.session-token',
    });
    
    console.log('[Share API POST] Token:', token ? { id: token.id, name: token.name } : null);
    
    if (!token?.id) {
      console.log('[Share API POST] Unauthorized - no token');
      return NextResponse.json({ 
        error: 'Unauthorized',
        message: 'Please login again' 
      }, { status: 401 });
    }

    const body = await request.json();
    const { action, reportType, permission, data, sessionId } = body;

    // Se action=saveAndExit, salvar no histórico e marcar sessão
    if (action === 'saveAndExit') {
      if (!sessionId || !data) {
        return NextResponse.json({ error: 'Missing sessionId or data' }, { status: 400 });
      }

      const session = await db.sharedSession.findUnique({
        where: { sessionId },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Salvar no histórico
      const reportData = typeof data === 'string' ? JSON.parse(data) : data;
      const inspection = reportData.inspection || {};
      
      const history = await db.reportHistory.create({
        data: {
          userId: token.id as string,
          userName: token.name as string || 'Unknown',
          reportType: session.reportType,
          tag: inspection.tag || 'Sem TAG',
          cliente: inspection.cliente || null,
          descricao: inspection.descricao || null,
          conclusao: reportData.conclusion || null,
          executantes: inspection.executantes || null,
          machineDown: inspection.machineDown || false,
          data: typeof data === 'string' ? data : JSON.stringify(data),
        },
      });

      // Marcar sessão como salva
      await db.sharedSession.update({
        where: { sessionId },
        data: {
          savedToHistory: true,
          historyId: history.id,
        },
      });

      return NextResponse.json({
        success: true,
        historyId: history.id,
        message: 'Relatório salvo no histórico com sucesso!',
      });
    }

    // Criar nova sessão
    if (!reportType || !data) {
      console.log('[Share API POST] Missing fields:', { 
        reportType: !!reportType, 
        data: !!data 
      });
      return NextResponse.json({ 
        error: 'Missing required fields',
        missing: {
          reportType: !reportType,
          data: !data
        }
      }, { status: 400 });
    }

    // Criar sessão com expiração de 24 horas
    const newSessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const session = await db.sharedSession.create({
      data: {
        sessionId: newSessionId,
        creatorId: token.id as string,
        creatorName: token.name as string || 'Unknown',
        reportType,
        permission: permission || 'view',
        data: JSON.stringify(data),
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'https://z-services-ai.onrender.com';
    const shareLink = `${baseUrl}/share/${newSessionId}`;

    return NextResponse.json({
      success: true,
      sessionId: newSessionId,
      shareLink,
      permission: session.permission,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error('[Share API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - Obter sessão compartilhada ou listar sessões do usuário
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const action = searchParams.get('action');

    // Se sessionId fornecido, retorna a sessão específica
    if (sessionId) {
      const session = await db.sharedSession.findUnique({
        where: { sessionId },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Verificar se expirou
      if (new Date() > session.expiresAt) {
        await db.sharedSession.delete({ where: { sessionId } });
        return NextResponse.json({ error: 'Session expired' }, { status: 410 });
      }

      return NextResponse.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          creatorName: session.creatorName,
          reportType: session.reportType,
          permission: session.permission,
          data: JSON.parse(session.data),
          expiresAt: session.expiresAt,
        },
      });
    }

    // Se action=list, lista sessões do usuário
    if (action === 'list') {
      const token = await getToken({ 
        req: request, 
        secret,
        cookieName: 'next-auth.session-token',
      });
      
      if (!token?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Buscar sessões onde o usuário é o criador OU que foram compartilhadas com ele
      // Por simplicidade, vamos retornar todas as sessões ativas
      const sessions = await db.sharedSession.findMany({
        where: {
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return NextResponse.json({
        success: true,
        sessions: sessions.map(s => ({
          sessionId: s.sessionId,
          creatorId: s.creatorId,
          creatorName: s.creatorName,
          reportType: s.reportType,
          permission: s.permission,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
        })),
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('[Share API GET] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Atualizar sessão compartilhada (sincronização em tempo real)
export async function PUT(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret,
      cookieName: 'next-auth.session-token',
    });
    
    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, data } = body;

    console.log('[Share API PUT] Session:', sessionId, 'User:', token.name);
    console.log('[Share API PUT] Data keys:', data ? Object.keys(data) : 'no data');

    if (!sessionId || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const session = await db.sharedSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      console.log('[Share API PUT] Session not found:', sessionId);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verificar permissão de edição
    if (session.permission !== 'edit') {
      return NextResponse.json({ error: 'This session is view only' }, { status: 403 });
    }

    // Atualizar dados
    await db.sharedSession.update({
      where: { sessionId },
      data: {
        data: JSON.stringify(data),
        updatedAt: new Date(),
      },
    });

    console.log('[Share API PUT] Updated successfully, timestamp:', data.lastModifiedAt);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Share API PUT] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deletar sessão compartilhada
export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ 
      req: request, 
      secret,
      cookieName: 'next-auth.session-token',
    });
    
    if (!token?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID' }, { status: 400 });
    }

    const session = await db.sharedSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Apenas o criador pode deletar
    if (session.creatorId !== token.id) {
      return NextResponse.json({ error: 'Only the creator can delete' }, { status: 403 });
    }

    await db.sharedSession.delete({
      where: { sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Share API DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

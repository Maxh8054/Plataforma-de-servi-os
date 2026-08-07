import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const defaultUsers = [
  { id: 1, nome: 'Ranielly Miranda De Souza', email: 'ranielly-s@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 2, nome: 'Girlene da Silva Nogueira', email: 'girlene-n@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 3, nome: 'Rafaela Cristine da Silva Martins', email: 'rafaela-m@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 5, nome: 'Marcos Antônio Lino Rosa', email: 'marcos-a@zaminebrasil.com', senha: '123456', nivel: 'Junior', role: 'funcionario' },
  { id: 6, nome: 'Marcos Paulo Moraes Borges', email: 'marcos-b@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 7, nome: 'Marcelo Goncalves de Paula', email: 'marcelo-p@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 8, nome: 'Higor Ataides Macedo', email: 'higor-a@zaminebrasil.com', senha: '123456', nivel: 'Junior', role: 'funcionario' },
  { id: 9, nome: 'Weslley Ferreira de Siqueira', email: 'weslley-f@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 11, nome: 'Charles de Andrade', email: 'charles-a@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 12, nome: 'Jose Carlos Rodrigues de Santana', email: 'jose-s@zaminebrasil.com', senha: '123456', nivel: 'Junior', role: 'funcionario' },
  { id: 13, nome: 'Max Henrique Araujo', email: 'max-r@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 14, nome: 'Emerson Luiz Alexandre', email: 'emerson-a@zaminebrasil.com', senha: 'admin123', nivel: 'Senior', role: 'gestor' },
  { id: 15, nome: 'Warlen Eduardo Pereira Silva', email: 'warlen-s@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 16, nome: 'Cicero de Sousa Costa', email: 'cicero-c@zaminebrasil.com', senha: '123456', nivel: 'Senior', role: 'funcionario' },
  { id: 17, nome: 'Guilherme Rodrigues Gonçalves', email: 'guilherme-r@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 99, nome: 'Gestor do Sistema', email: 'gestor@zaminebrasil.com', senha: 'admin123', nivel: 'Administrador', role: 'gestor' },
  { id: 100, nome: 'Fabricio Cezar de Almeida', email: 'fabricio-c@zaminebrasil.com', senha: 'admin123', nivel: 'Coordenador', role: 'gestor' },
  { id: 101, nome: 'Julio Cesar Sanches', email: 'julio-s@zaminebrasil.com', senha: 'admin123', nivel: 'Gerente', role: 'gestor' },
  { id: 102, nome: 'Wenderson Augusto de Oliveira', email: 'wenderson-a@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 103, nome: 'Wallysson Silva', email: 'wallysson-s@zaminebrasil.com', senha: 'admin123', nivel: 'Senior', role: 'gestor' },
  { id: 106, nome: 'Robson Mendes', email: 'robson-m@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 107, nome: 'Rodrigo Vieira', email: 'rodrigo-v@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 108, nome: 'Marlon Mendes', email: 'marlon-m@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 110, nome: 'Guilherme Silva', email: 'guilherme-s@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 111, nome: 'Fabricio Silva', email: 'fabricio-s@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 112, nome: 'Vinicius Mendes', email: 'vinicius-m@zaminebrasil.com', senha: '123456', nivel: 'Pleno', role: 'funcionario' },
  { id: 200, nome: 'Robson Vicente Rodrigues Magalhães', email: 'robson-v@zaminebrasil.com', senha: '2026', nivel: 'Administrador', role: 'gestor' },
];

// POST /api/zab-flow/seed - Seed the database with default users
export async function POST() {
  try {
    for (const user of defaultUsers) {
      await db.zabUsuario.upsert({
        where: { id: user.id },
        update: {
          nome: user.nome, email: user.email, senha: user.senha,
          nivel: user.nivel, role: user.role, conquistas: '[]',
        },
        create: {
          id: user.id, nome: user.nome, email: user.email, senha: user.senha,
          nivel: user.nivel, pontos: 0, conquistas: '[]', role: user.role,
        },
      });
    }

    try { await db.zabUsuario.deleteMany({ where: { id: 10 } }); } catch { /* ignore */ }

    const totalUsers = await db.zabUsuario.count();

    return NextResponse.json({
      message: 'Seed executado com sucesso',
      processed: defaultUsers.length,
      totalUsers,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Erro ao popular o banco de dados', details: errorMsg }, { status: 500 });
  }
}
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function seed() {
  const count = await db.user.count();
  if (count > 0) {
    console.log('Banco ja tem ' + count + ' usuarios, pulando seed.');
    return;
  }

  console.log('Banco vazio, criando usuarios...');

  const users = [
    { name: 'Max Rodrigues', email: 'max-r@zaminebrasil.com', role: 'ADMIN' },
    { name: 'Charles de Andrade', email: 'charles-a@zaminebrasil.com', role: 'USER' },
    { name: 'Cicero de Sousa Costa', email: 'cicero-c@zaminebrasil.com', role: 'USER' },
    { name: 'Emerson Luiz Alexandre', email: 'emerson-a@zaminebrasil.com', role: 'USER' },
    { name: 'Fabricio Cezar de Almeida', email: 'fabricio-c@zaminebrasil.com', role: 'USER' },
    { name: 'Girlene da Silva Nogueira', email: 'girlene-n@zaminebrasil.com', role: 'USER' },
    { name: 'Guilherme Rodrigues Gonçalves', email: 'guilherme-r@zaminebrasil.com', role: 'USER' },
    { name: 'Higor Ataides Macedo', email: 'higor-a@zaminebrasil.com', role: 'USER' },
    { name: 'Jose Carlos Rodrigues de Santana', email: 'jose-s@zaminebrasil.com', role: 'USER' },
    { name: 'Julio Cesar Sanches', email: 'julio-s@zaminebrasil.com', role: 'USER' },
    { name: 'Marcelo Goncalves de Paula', email: 'marcelo-p@zaminebrasil.com', role: 'USER' },
    { name: 'Marcos Paulo Moraes Borges', email: 'marcos-b@zaminebrasil.com', role: 'USER' },
    { name: 'Marlon Mendes Silva', email: 'marlon-m@zaminebrasil.com', role: 'USER' },
    { name: 'Rafaela Cristine da Silva Martins', email: 'rafaela-m@zaminebrasil.com', role: 'USER' },
    { name: 'Ranielly Miranda De Souza', email: 'ranielly-s@zaminebrasil.com', role: 'USER' },
    { name: 'Robson Vicente Rodrigues Magalhães', email: 'robson-v@zaminebrasil.com', role: 'USER' },
    { name: 'Robson Junio Alves de Moura', email: 'robson-m@zaminebrasil.com', role: 'USER' },
    { name: 'Rodrigo Valentino Victor', email: 'rodrigo-v@zaminebrasil.com', role: 'USER' },
    { name: 'Vinicius Miranda de Alvarenga', email: 'vinicius-m@zaminebrasil.com', role: 'USER' },
    { name: 'Wallysson Diego Santiago Santos', email: 'wallysson-s@zaminebrasil.com', role: 'USER' },
    { name: 'Warlen Eduardo Pereira Silva', email: 'warlen-s@zaminebrasil.com', role: 'USER' },
    { name: 'Wenderson Augusto de Oliveira', email: 'wenderson-a@zaminebrasil.com', role: 'USER' },
    { name: 'Weslley Ferreira de Siqueira', email: 'weslley-f@zaminebrasil.com', role: 'USER' }
  ];

  const r = await db.user.createMany({ data: users });
  console.log('Seed concluido: ' + r.count + ' usuarios criados.');
}

seed()
  .catch(e => { console.error('Erro no seed:', e); process.exit(1); })
  .finally(() => db.$disconnect());

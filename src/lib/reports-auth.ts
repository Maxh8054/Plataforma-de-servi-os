import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Pre-defined users
export const PREDEFINED_USERS = [
  { id: '1', name: 'Emerson Luiz Alexandre', email: 'emerson@zaminebrasil.com', password: '2026' },
  { id: '2', name: 'Warlen Eduardo Pereira Silva', email: 'warlen@zaminebrasil.com', password: '2026' },
  { id: '3', name: 'Cicero de Sousa Costa', email: 'cicero@zaminebrasil.com', password: '2026' },
  { id: '4', name: 'Max Henrique Araujo', email: 'max-r@zaminebrasil.com', password: '2026' },
  { id: '5', name: 'Jose Carlos Rodrigues de Santana', email: 'jose@zaminebrasil.com', password: '2026' },
  { id: '6', name: 'Charles de Andrade', email: 'charles@zaminebrasil.com', password: '2026' },
  { id: '7', name: 'Rafaela Cristine da Silva Martins', email: 'rafaela@zaminebrasil.com', password: '2026' },
  { id: '8', name: 'Guilherme Rodrigues Gonçalves', email: 'guilherme-r@zaminebrasil.com', password: '2026' },
  { id: '9', name: 'Wallysson Diego Santiago Santos', email: 'wallysson@zaminebrasil.com', password: '2026' },
  { id: '10', name: 'Weslley Ferreira de Siqueira', email: 'weslley@zaminebrasil.com', password: '2026' },
  { id: '11', name: 'Higor Ataides Macedo', email: 'higor@zaminebrasil.com', password: '2026' },
  { id: '12', name: 'Marcos Paulo Moraes Borges', email: 'marcos@zaminebrasil.com', password: '2026' },
  { id: '13', name: 'Marcelo Goncalves de Paula', email: 'marcelo@zaminebrasil.com', password: '2026' },
  { id: '14', name: 'Fabricio Cezar de Almeida', email: 'fabricio-c@zaminebrasil.com', password: '2026' },
  { id: '15', name: 'Ramon Lucas Mendes de Almeida Costa', email: 'ramon@zaminebrasil.com', password: '2026' },
  { id: '16', name: 'Julio Sanches', email: 'julio@zaminebrasil.com', password: '2026' },
  { id: '18', name: 'Wenderson Augusto de Oliveira', email: 'wenderson-a@zaminebrasil.com', password: '2026' },
  { id: '19', name: 'Vinicius Miranda', email: 'convidado@zaminebrasil.com', password: '2026' },
  { id: '20', name: 'Robson Vicente Rodrigues Magalhães', email: 'robson-v@zaminebrasil.com', password: '2026' },
 ];

// Users who can access the History tab (Dashboard, Ranking, Reports)
export const HISTORY_ADMINS = [
  'wallysson@zaminebrasil.com',  // Wallysson
  'fabricio-c@zaminebrasil.com',     // Fabricio
  'emerson@zaminebrasil.com',    // Emerson
  'julio@zaminebrasil.com',      // Julio
];

// Helper function to check if user is history admin
export const isHistoryAdmin = (email: string | null | undefined): boolean => {
  return HISTORY_ADMINS.includes(email || '');
};

// Admin email for password reset
export const ADMIN_EMAIL = 'max-r@zaminebrasil.com';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Check predefined users first (plain text comparison)
        const predefinedUser = PREDEFINED_USERS.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (predefinedUser) {
          // Try to sync with database (optional - don't fail if DB is down)
          try {
            const { db } = await import('@/lib/db');
            let dbUser = await db.user.findUnique({
              where: { email: credentials.email },
            });

            if (!dbUser) {
              const hashedPassword = await bcrypt.hash(credentials.password, 10);
              dbUser = await db.user.create({
                data: {
                  email: predefinedUser.email,
                  name: predefinedUser.name,
                  password: hashedPassword,
                },
              });
            }

            return {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name,
            };
          } catch {
            // Database not available - return user from predefined list
            return {
              id: predefinedUser.id,
              email: predefinedUser.email,
              name: predefinedUser.name,
            };
          }
        }

        // Check database for updated passwords (optional)
        try {
          const { db } = await import('@/lib/db');
          const user = await db.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user || !user.password) {
            return null;
          }

          const passwordMatch = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (!passwordMatch) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-key-z-services-ai-2024',
  pages: {
    signIn: '/',
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
  }
}
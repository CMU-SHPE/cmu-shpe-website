import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { jwtCallback, sessionCallback } from '@/lib/auth-callbacks'
import { authorizeAdmin } from '@/lib/authorize'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials, request) {
        return authorizeAdmin(credentials, request.headers?.get('x-forwarded-for') ?? null)
      },
    }),
  ],
  callbacks: { jwt: jwtCallback, session: sessionCallback },
})

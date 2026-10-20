import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { AdminRole } from '@/db/schema'
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
  callbacks: {
    /**
     * authTime is set only when a password sign-in produces `user`. The JWT is
     * re-encoded with a fresh `iat` on every session read, and clients can call
     * the update trigger, so neither may move it forward.
     */
    jwt({ token, user, trigger }) {
      if (user && trigger !== 'update') {
        token.role = user.role
        token.authTime = Date.now()
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub ?? ''
      session.user.role = token.role as AdminRole
      session.authTime = token.authTime
      return session
    },
  },
})

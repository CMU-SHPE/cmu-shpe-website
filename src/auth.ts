import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { jwtCallback, sessionCallback } from '@/lib/auth-callbacks'
import { authorizeCredentials } from '@/lib/authorize'
import { readKnownDevice, rememberKnownDevice } from '@/lib/known-device'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const forwardedFor = request.headers?.get('x-forwarded-for') ?? null
        const user = await authorizeCredentials(credentials, forwardedFor, await readKnownDevice())
        if (user) await rememberKnownDevice(user.email)
        return user
      },
    }),
  ],
  callbacks: { jwt: jwtCallback, session: sessionCallback },
})

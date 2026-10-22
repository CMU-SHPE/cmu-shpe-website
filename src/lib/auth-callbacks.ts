import type { NextAuthConfig } from 'next-auth'
import type { AdminRole } from '@/db/schema'

type Callbacks = NonNullable<NextAuthConfig['callbacks']>

/**
 * authTime comes from the password check (see authorizeAdmin) and is copied only
 * when a sign-in produces `user`. The JWT is re-encoded with a fresh `iat` on
 * every session read, and clients can call the update trigger, so neither may
 * move it forward.
 */
export const jwtCallback: NonNullable<Callbacks['jwt']> = ({ token, user, trigger }) => {
  if (user && trigger !== 'update') {
    token.role = user.role
    token.authTime = user.authTime
  }
  return token
}

export const sessionCallback: NonNullable<Callbacks['session']> = ({ session, token }) => {
  session.user.id = token.sub ?? ''
  session.user.role = token.role as AdminRole
  session.authTime = token.authTime
  return session
}

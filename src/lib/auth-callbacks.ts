import type { NextAuthConfig } from 'next-auth'

type Callbacks = NonNullable<NextAuthConfig['callbacks']>

/**
 * authTime comes from the password check (see authorizeCredentials) and is copied only
 * when a sign-in produces `user`. The JWT is re-encoded with a fresh `iat` on
 * every session read, and clients can call the update trigger, so neither may
 * move it forward.
 */
export const jwtCallback: NonNullable<Callbacks['jwt']> = ({ token, user, trigger }) => {
  if (user && trigger !== 'update') {
    token.kind = user.kind
    token.role = user.role
    token.authTime = user.authTime
  }
  return token
}

export const sessionCallback: NonNullable<Callbacks['session']> = ({ session, token }) => {
  session.user.id = token.sub ?? ''
  if (token.kind) session.user.kind = token.kind
  session.user.role = token.role
  session.authTime = token.authTime
  return session
}

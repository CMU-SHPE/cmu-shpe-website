import type { DefaultSession } from 'next-auth'
import type { AdminRole, MemberRole } from '@/db/schema'

export type AccountKind = 'admin' | 'member'

declare module 'next-auth' {
  interface User {
    kind: AccountKind
    role: AdminRole | MemberRole
    authTime?: number
  }

  interface Session {
    user: DefaultSession['user'] & {
      id: string
      /** Missing on tokens issued before members existed; those are admin sessions. */
      kind?: AccountKind
      /** Narrowed by currentAdmin() and currentMember(), which take it from the database. */
      role: AdminRole | MemberRole
      /** Set only by currentAdmin() from the database, never carried in the JWT. */
      canCreateAccounts?: boolean
    }
    /** Epoch milliseconds when the account last signed in with a password. */
    authTime?: number
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    kind?: AccountKind
    role: AdminRole | MemberRole
    authTime?: number
  }
}

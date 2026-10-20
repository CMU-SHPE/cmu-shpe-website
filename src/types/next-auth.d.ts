import type { DefaultSession } from 'next-auth'
import type { AdminRole } from '@/db/schema'

declare module 'next-auth' {
  interface User {
    role: AdminRole
    authTime?: number
  }

  interface Session {
    user: DefaultSession['user'] & { id: string; role: AdminRole }
    /** Epoch milliseconds when the admin last signed in with a password. */
    authTime?: number
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role: AdminRole
    authTime?: number
  }
}

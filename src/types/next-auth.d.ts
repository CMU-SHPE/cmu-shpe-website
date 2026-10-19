import type { DefaultSession } from 'next-auth'
import type { AdminRole } from '@/db/schema'

declare module 'next-auth' {
  interface User {
    role: AdminRole
  }

  interface Session {
    user: DefaultSession['user'] & { id: string; role: AdminRole }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: AdminRole
  }
}

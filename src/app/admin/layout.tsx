import { redirect } from 'next/navigation'
import { currentAdmin } from '@/lib/admin'
import { mayCreateAccounts } from '@/lib/admin-account'
import AdminNav from '@/components/admin/admin-nav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin()
  if (!admin) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row lg:px-8">
        <AdminNav canCreateAccounts={mayCreateAccounts(admin.user)} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

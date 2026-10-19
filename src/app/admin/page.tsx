import { requireAdmin } from '@/lib/admin'
import { pageHeadingClass } from '@/components/admin/styles'

export default async function AdminDashboard() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Dashboard</h1>
      <p className="rounded-xl border border-gray-200 dark:border-gray-700 border-l-4 border-l-shpe-gold dark:border-l-shpe-gold bg-white dark:bg-gray-900 p-4 text-sm text-gray-700 dark:text-gray-300">
        Page text is edited directly on the site while you are signed in — open any page and
        click text to edit it. Lists, people, sponsors, events and settings are managed from
        this sidebar.
      </p>
    </div>
  )
}

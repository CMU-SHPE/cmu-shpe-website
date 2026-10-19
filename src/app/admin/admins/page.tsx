import { asc } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins } from '@/db/schema'
import SubmitButton from '@/components/submit-button'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
  tableClass,
  tableHeadRowClass,
  tableRowClass,
} from '@/components/admin/styles'
import { requireMaster } from '@/lib/admin'
import { createAdmin, deleteAdmin } from './actions'

const errorMessages: Record<string, string> = {
  invalid: 'Please check the fields — passwords must be at least 12 characters.',
  duplicate: 'An account with that email already exists.',
  self: 'You cannot delete your own account.',
  master: 'Master accounts cannot be deleted.',
}

const roleLabels = { admin: 'Admin', master: 'Master' } as const

export default async function AdminAccountsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const session = await requireMaster()
  const [{ saved, error }, rows] = await Promise.all([
    props.searchParams,
    getDb()
      .select({ id: admins.id, name: admins.name, email: admins.email, role: admins.role })
      .from(admins)
      .orderBy(asc(admins.name)),
  ])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Admin accounts</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <section className={cardClass} aria-labelledby="create-admin-heading">
        <h2 id="create-admin-heading" className={sectionHeadingClass}>
          Create admin
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Create the account and share the password with them directly — there is no email
          invitation.
        </p>
        <form action={createAdmin} className="mt-4 max-w-md space-y-4">
          <label className={labelClass}>
            Name
            <input name="name" required maxLength={200} autoComplete="off" className={inputClass} />
          </label>
          <label className={labelClass}>
            Email
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="off"
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Password (12+ characters)
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={200}
              autoComplete="new-password"
              className={inputClass}
            />
          </label>
          <SubmitButton pendingLabel="Creating…" className={primaryButtonClass}>
            Create account
          </SubmitButton>
        </form>
      </section>

      <section className={`${cardClass} overflow-x-auto`} aria-labelledby="accounts-heading">
        <h2 id="accounts-heading" className={sectionHeadingClass}>
          Accounts
        </h2>
        <table className={`mt-4 ${tableClass}`}>
          <thead>
            <tr className={tableHeadRowClass}>
              <th scope="col" className="py-2 pr-4 font-medium">
                Name
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Email
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Role
              </th>
              <th scope="col" className="py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((admin) => (
              <tr key={admin.id} className={tableRowClass}>
                <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">
                  {admin.name}
                  {String(admin.id) === session.user.id && (
                    <span className={`ml-2 ${mutedTextClass}`}>(you)</span>
                  )}
                </td>
                <td className="py-3 pr-4 break-all">{admin.email}</td>
                <td className="py-3 pr-4">{roleLabels[admin.role]}</td>
                <td className="py-3 text-right">
                  {admin.role !== 'master' && (
                    <form action={deleteAdmin.bind(null, admin.id)}>
                      <SubmitButton pendingLabel="Deleting…" className={dangerButtonClass}>
                        Delete<span className="sr-only"> {admin.name}</span>
                      </SubmitButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

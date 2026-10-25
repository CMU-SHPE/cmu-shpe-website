import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { getDb } from '@/db'
import { admins } from '@/db/schema'
import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
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
import { requireAccountCreator } from '@/lib/admin'
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@/lib/admin-account'
import { createAdmin, deleteAdmin } from './actions'
import AccountCreatorToggle from './account-creator-toggle'
import ResetPassword, { linkClass } from './reset-password'

const errorMessages: Record<string, string> = {
  invalid: 'Please check the name and email.',
  password: `Passwords must be at least ${MIN_PASSWORD_LENGTH} characters and at most ${MAX_PASSWORD_BYTES} bytes. Accented letters and emoji count as 2 to 4 bytes each.`,
  duplicate: 'An account with that email already exists.',
  mismatch: 'The new password and its confirmation do not match.',
  missing: 'That admin account no longer exists.',
  self: 'You cannot delete, reset or change permissions for your own account here. Use Change password for your own password.',
  master: 'Master accounts cannot be deleted, reset or changed here.',
}

const roleLabels = { admin: 'Admin', master: 'Master' } as const

export default async function AdminAccountsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const session = await requireAccountCreator()
  const isMaster = session.user.role === 'master'
  const [{ saved, error }, rows] = await Promise.all([
    props.searchParams,
    getDb()
      .select({
        id: admins.id,
        name: admins.name,
        email: admins.email,
        role: admins.role,
        canCreateAccounts: admins.canCreateAccounts,
      })
      .from(admins)
      .orderBy(asc(admins.name)),
  ])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Admin accounts</h1>

      <StatusBanner
        saved={saved}
        error={error}
        errorMessages={errorMessages}
        savedMessage={
          saved === 'reset'
            ? 'Password reset. Share it with them directly; they have been signed out everywhere.'
            : 'Saved.'
        }
      />

      <section className={cardClass} aria-labelledby="create-admin-heading">
        <h2 id="create-admin-heading" className={sectionHeadingClass}>
          Create admin
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Create the account and share the password with them directly — there is no email
          invitation. New accounts can edit the site but cannot create other accounts
          {isMaster ? ' until you allow it below.' : '.'}
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
            Password ({MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_BYTES} characters)
            <input
              name="password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_BYTES}
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
            {rows.map((admin) => {
              const isSelf = String(admin.id) === session.user.id
              return (
                <tr key={admin.id} className={tableRowClass}>
                  <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white">
                    {admin.name}
                    {isSelf && <span className={`ml-2 ${mutedTextClass}`}>(you)</span>}
                  </td>
                  <td className="py-3 pr-4 break-all">{admin.email}</td>
                  <td className="py-3 pr-4">{roleLabels[admin.role]}</td>
                  <td className="py-3 text-right align-top">
                    {isSelf ? (
                      <Link href="/admin/account" className={linkClass}>
                        Change your password
                      </Link>
                    ) : (
                      isMaster &&
                      admin.role === 'admin' && (
                        <div className="flex flex-col items-end gap-2">
                          <AccountCreatorToggle
                            id={admin.id}
                            name={admin.name}
                            enabled={admin.canCreateAccounts}
                          />
                          <form action={deleteAdmin.bind(null, admin.id)}>
                            <DeleteButton name={admin.name} />
                          </form>
                          <ResetPassword id={admin.id} name={admin.name} email={admin.email} />
                        </div>
                      )
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

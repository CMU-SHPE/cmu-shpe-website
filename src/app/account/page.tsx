import { requireMember } from '@/lib/member'
import { cardClass, mutedTextClass, pageHeadingClass } from '@/components/admin/styles'

export default async function AccountPage() {
  const member = await requireMember()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 px-4 py-20">
      <section className={`mx-auto w-full max-w-lg space-y-3 ${cardClass}`}>
        <h1 className={pageHeadingClass}>Your account</h1>
        <p className="text-gray-700 dark:text-gray-300">
          Signed in as <span className="font-semibold">{member.user.name}</span> ({member.user.email}).
        </p>
        <p className={mutedTextClass}>Newsletter choices and account settings will appear here soon.</p>
      </section>
    </div>
  )
}

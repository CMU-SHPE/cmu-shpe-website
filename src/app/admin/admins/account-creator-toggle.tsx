import SubmitButton from '@/components/submit-button'
import { focusRingClass } from '@/components/admin/styles'
import { setCanCreateAccounts } from './actions'

export default function AccountCreatorToggle({
  id,
  name,
  enabled,
}: {
  id: number
  name: string
  enabled: boolean
}) {
  return (
    <form action={setCanCreateAccounts.bind(null, id, !enabled)}>
      <SubmitButton
        aria-pressed={enabled}
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${focusRingClass} ${
          enabled
            ? 'border-cmu-maroon bg-cmu-maroon text-white hover:bg-red-900 dark:border-shpe-gold dark:bg-shpe-gold dark:text-gray-900 dark:hover:bg-yellow-400'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {'Can create accounts '}
        <span className="sr-only">for {name}</span>
        <span aria-hidden="true">{enabled ? '· On' : '· Off'}</span>
      </SubmitButton>
    </form>
  )
}

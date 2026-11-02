import type { ListingSaveRefusal } from '@/lib/sponsor-schema'

export default function ListingRefusalNotice({ refusal }: { refusal: ListingSaveRefusal | null }) {
  if (!refusal) return null
  const typedConflicts = refusal.conflicts.filter((conflict) => conflict.field !== 'Logo')
  return (
    <div
      role="alert"
      className="space-y-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
    >
      <p>Someone else changed this listing while you were editing, so nothing was saved.</p>
      {typedConflicts.length > 0 && (
        <>
          <p>
            You both changed the fields below. The form still has what you typed, and saving again replaces the saved
            version shown here.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {typedConflicts.map(({ field, saved }) => (
              <li key={field} className="break-words">
                {field}, saved version: {saved || '(empty)'}
              </li>
            ))}
          </ul>
        </>
      )}
      {refusal.logoDropped && (
        <p>Your logo change wasn’t kept. The form shows the saved logo, so choose yours again before saving.</p>
      )}
      <p>Check the form and save again.</p>
    </div>
  )
}

import { focusRingClass } from '@/components/admin/styles'

export default function EditDetails({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <details className="mt-3">
      <summary
        className={`cursor-pointer rounded text-sm font-medium text-shpe-red dark:text-shpe-gold ${focusRingClass}`}
      >
        Edit<span className="sr-only"> {name}</span>
      </summary>
      {children}
    </details>
  )
}

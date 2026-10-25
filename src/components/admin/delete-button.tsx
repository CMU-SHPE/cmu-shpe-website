'use client'

import SubmitButton from '@/components/submit-button'
import { dangerButtonClass } from '@/components/admin/styles'

export default function DeleteButton({ name, warning }: { name: string; warning?: string }) {
  const message = warning ? `Delete ${name}? ${warning} This can't be undone.` : `Delete ${name}? This can't be undone.`

  return (
    <SubmitButton
      pendingLabel="Deleting…"
      className={dangerButtonClass}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault()
      }}
    >
      {'Delete '}
      <span className="sr-only">{name}</span>
    </SubmitButton>
  )
}

'use client'

import SubmitButton from '@/components/submit-button'
import { dangerButtonClass } from '@/components/admin/styles'

export default function DeleteButton({ name }: { name: string }) {
  return (
    <SubmitButton
      pendingLabel="Deleting…"
      className={dangerButtonClass}
      onClick={(event) => {
        if (!window.confirm(`Delete ${name}? This can't be undone.`)) event.preventDefault()
      }}
    >
      {'Delete '}
      <span className="sr-only">{name}</span>
    </SubmitButton>
  )
}

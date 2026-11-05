'use client'

import { useId, useState } from 'react'
import DeleteButton from '@/components/admin/delete-button'
import { focusRingClass, labelClass } from '@/components/admin/styles'

/** The confirmation names exactly what the chosen option removes, so it changes with the choice. */
export default function SeriesDeleteForm({
  action,
  name,
  eventWarning,
  laterWarning,
}: {
  action: (formData: FormData) => void | Promise<void>
  name: string
  eventWarning: string
  laterWarning: string
}) {
  const idPrefix = useId()
  const [scope, setScope] = useState<'event' | 'later'>('event')
  const options = [
    { value: 'event', label: 'This event' },
    { value: 'later', label: 'This and later events in the series' },
  ] as const

  return (
    <form action={action} className="space-y-2">
      <fieldset className="space-y-1">
        <legend className={labelClass}>
          {'Delete '}
          <span className="sr-only">{name}</span>
        </legend>
        {options.map((option) => (
          <div key={option.value} className="flex items-center gap-2">
            <input
              id={`${idPrefix}-${option.value}`}
              name="scope"
              type="radio"
              value={option.value}
              checked={scope === option.value}
              onChange={() => setScope(option.value)}
              className={`h-4 w-4 ${focusRingClass}`}
            />
            <label htmlFor={`${idPrefix}-${option.value}`} className="text-sm text-gray-700 dark:text-gray-300">
              {option.label}
            </label>
          </div>
        ))}
      </fieldset>
      <DeleteButton name={name} warning={scope === 'later' ? laterWarning : eventWarning} />
    </form>
  )
}

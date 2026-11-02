'use client'

import { useEffect, useId, useRef } from 'react'
import { focusRingClass } from '@/components/admin/styles'
import type { ListingSaveRefusal } from '@/lib/sponsor-schema'

export default function ListingRefusalNotice({ refusal }: { refusal: ListingSaveRefusal | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const contentId = useId()

  useEffect(() => {
    if (refusal) ref.current?.focus()
  }, [refusal])

  if (!refusal) return null
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Nothing was saved"
      aria-describedby={contentId}
      tabIndex={-1}
      className={`rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 ${focusRingClass}`}
    >
      <div id={contentId} className="space-y-2">
        <p>
          {refusal.reason === 'outdated'
            ? 'This page was out of date, so nothing was saved.'
            : 'Someone else changed this listing while you were editing, so nothing was saved.'}
        </p>
        {refusal.conflicts.length > 0 && (
          <>
            <p>
              You both changed the fields below. The form still has what you typed, and saving again replaces the
              saved version shown here.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {refusal.conflicts.map(({ field, saved }) => (
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
    </div>
  )
}

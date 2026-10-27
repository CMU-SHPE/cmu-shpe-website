'use client'

import { useActionState, useEffect, useId, useRef } from 'react'
import SubmitButton from '@/components/submit-button'
import { cardClass, focusRingClass, inputClass, labelClass, primaryButtonClass } from '@/components/admin/styles'
import type { FormState } from '@/lib/member-accounts'

export type AccountField = {
  name: string
  label: React.ReactNode
  type: 'text' | 'email' | 'password' | 'checkbox'
  autoComplete?: string
  hint?: React.ReactNode
  maxLength?: number
}

type AttemptState = FormState & { attempt: number }

// Not a live region: focus moves here after each failed attempt, and a live role would read it twice.
const ERROR_SUMMARY_LABEL = 'There is a problem'

const errorTextClass = 'mt-1 text-sm text-red-700 dark:text-red-400'

function ErrorSummary({
  state,
  fields,
  fieldId,
}: {
  state: AttemptState
  fields: AccountField[]
  fieldId: (name: string) => string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const contentId = useId()
  const fieldErrors = fields.filter((field) => state.errors?.[field.name])
  const hasErrors = Boolean(state.formError) || fieldErrors.length > 0

  useEffect(() => {
    if (hasErrors) ref.current?.focus()
  }, [state.attempt, hasErrors])

  if (!hasErrors) return null
  return (
    <div
      ref={ref}
      role="group"
      aria-label={ERROR_SUMMARY_LABEL}
      aria-describedby={contentId}
      tabIndex={-1}
      className={`rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 ${focusRingClass}`}
    >
      {/* Some screen readers read only a focused group's label, so the errors are also its description. */}
      <div id={contentId}>
        {state.formError && <p>{state.formError}</p>}
        {fieldErrors.length > 0 && (
          <>
            <p className="font-semibold">Please fix the following:</p>
            <ul className="mt-1 list-disc pl-5">
              {fieldErrors.map((field) => (
                <li key={field.name}>
                  <a href={`#${fieldId(field.name)}`} className={`underline ${focusRingClass}`}>
                    {state.errors?.[field.name]}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * The form remounts after each attempt so its inputs pick up the echoed values: React
 * resets uncontrolled fields once an action finishes.
 */
export default function AccountForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  hidden = {},
  username,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  fields: AccountField[]
  submitLabel: string
  pendingLabel: string
  hidden?: Record<string, string>
  /** For a password-only form, so password managers know which account the password belongs to. */
  username?: string
  children?: React.ReactNode
}) {
  const formId = useId()
  const fieldId = (name: string) => `${formId}-${name}`
  const [state, formAction] = useActionState<AttemptState, FormData>(
    async (previous, formData) => ({ ...(await action(previous, formData)), attempt: previous.attempt + 1 }),
    { attempt: 0 },
  )

  return (
    <div className={`space-y-5 ${cardClass}`}>
      <ErrorSummary state={state} fields={fields} fieldId={fieldId} />
      <form key={state.attempt} action={formAction} className="space-y-5" noValidate>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {username !== undefined && (
          <input type="email" name="username" value={username} autoComplete="username" readOnly hidden />
        )}
        {fields.map((field) => {
          const id = fieldId(field.name)
          const error = state.errors?.[field.name]
          const describedBy = [error && `${id}-error`, field.hint && `${id}-hint`].filter(Boolean).join(' ')
          const shared = {
            id,
            name: field.name,
            required: true,
            'aria-invalid': error ? true : undefined,
            'aria-describedby': describedBy || undefined,
          }
          const hint = field.hint && (
            <p id={`${id}-hint`} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {field.hint}
            </p>
          )
          const errorText = error && (
            <p id={`${id}-error`} className={errorTextClass}>
              {error}
            </p>
          )

          if (field.type === 'checkbox') {
            return (
              <div key={field.name}>
                <div className="flex items-start gap-3">
                  <input
                    {...shared}
                    type="checkbox"
                    defaultChecked={state.values?.[field.name] === 'on'}
                    className={`mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-shpe-red ${focusRingClass}`}
                  />
                  <label htmlFor={id} className="text-sm text-gray-700 dark:text-gray-300">
                    {field.label}
                  </label>
                </div>
                {hint}
                {errorText}
              </div>
            )
          }

          return (
            <div key={field.name}>
              <label htmlFor={id} className={labelClass}>
                {field.label}
              </label>
              <input
                {...shared}
                type={field.type}
                autoComplete={field.autoComplete}
                maxLength={field.maxLength}
                defaultValue={field.type === 'password' ? undefined : state.values?.[field.name]}
                className={inputClass}
              />
              {hint}
              {errorText}
            </div>
          )
        })}
        {children}
        <SubmitButton pendingLabel={pendingLabel} className={`w-full ${primaryButtonClass}`}>
          {submitLabel}
        </SubmitButton>
      </form>
    </div>
  )
}

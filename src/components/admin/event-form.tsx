'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import SubmitButton from '@/components/submit-button'
import TimeSlotEditor, { errorTextClass, slotInputId } from '@/components/admin/time-slot-editor'
import { focusRingClass, inputClass, labelClass, mutedTextClass, primaryButtonClass } from '@/components/admin/styles'
import type { EventFormState, EventFormValues } from '@/lib/event-form'
import { MAX_EVENT_CAPACITY, MAX_EVENT_DESCRIPTION_LENGTH } from '@/lib/event-schema'
import { EVENT_TYPES } from '@/lib/event-types'

type AttemptState = EventFormState & { attempt: number }

const SLOT_FIELD_ORDER = ['startDate', 'endDate', 'startTime', 'endTime'] as const

const EMPTY_VALUES: EventFormValues = {
  title: '',
  description: '',
  location: '',
  type: EVENT_TYPES[0],
  date: '',
  endDate: '',
  time: '',
  capacity: '',
  slots: [],
}

const FIELD_ORDER = ['title', 'description', 'location', 'type', 'date', 'endDate', 'time', 'capacity'] as const

function orderedErrors(errors: Record<string, string>, idPrefix: string) {
  const fieldErrors = FIELD_ORDER.filter((field) => errors[field]).map((field) => ({
    href: `${idPrefix}-${field}`,
    message: errors[field],
  }))
  const slotErrors = Object.keys(errors)
    .filter((key) => key.startsWith('slots.'))
    .map((key) => key.split('.'))
    .sort(
      ([, a, fieldA], [, b, fieldB]) =>
        Number(a) - Number(b) ||
        SLOT_FIELD_ORDER.indexOf(fieldA as (typeof SLOT_FIELD_ORDER)[number]) -
          SLOT_FIELD_ORDER.indexOf(fieldB as (typeof SLOT_FIELD_ORDER)[number]),
    )
    .map(([, row, field]) => ({
      href: slotInputId(idPrefix, Number(row), field as (typeof SLOT_FIELD_ORDER)[number]),
      message: `Time slot ${Number(row) + 1}: ${errors[`slots.${row}.${field}`]}`,
    }))
  const listError = errors.slots ? [{ href: `${idPrefix}-add-slot`, message: errors.slots }] : []
  return [...fieldErrors, ...listError, ...slotErrors]
}

// Not a live region: focus moves here after each refused save, and a live role would read it twice.
function ErrorSummary({ errors, idPrefix, attempt }: { errors: Record<string, string>; idPrefix: string; attempt: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const contentId = useId()
  const items = orderedErrors(errors, idPrefix)

  useEffect(() => {
    if (items.length > 0) ref.current?.focus()
  }, [attempt, items.length])

  if (items.length === 0) return null
  return (
    <div
      ref={ref}
      role="group"
      aria-label="There is a problem"
      aria-describedby={contentId}
      tabIndex={-1}
      className={`rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 ${focusRingClass}`}
    >
      <div id={contentId}>
        <p className="font-semibold">Nothing was saved. Please fix the following:</p>
        <ul className="mt-1 list-disc pl-5">
          {items.map((item) => (
            <li key={item.href}>
              <a href={`#${item.href}`} className={`underline ${focusRingClass}`}>
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className={errorTextClass}>
      {message}
    </p>
  )
}

function EventFields({
  idPrefix,
  values,
  errors,
}: {
  idPrefix: string
  values: EventFormValues
  errors: Record<string, string>
}) {
  const [startDate, setStartDate] = useState(values.date)
  const [endDate, setEndDate] = useState(values.endDate)
  const [slotCount, setSlotCount] = useState(values.slots.length)

  const id = (field: string) => `${idPrefix}-${field}`
  const describedBy = (field: string, hint?: string) =>
    [errors[field] && `${id(field)}-error`, hint].filter(Boolean).join(' ') || undefined
  const invalid = (field: string) => (errors[field] ? true : undefined)
  const capacityHint = id('capacity-hint')
  const endDateHint = id('endDate-hint')
  const timeHint = id('time-hint')

  return (
    <>
      <div>
        <label htmlFor={id('title')} className={labelClass}>
          Title
        </label>
        <input
          id={id('title')}
          name="title"
          required
          maxLength={200}
          defaultValue={values.title}
          aria-invalid={invalid('title')}
          aria-describedby={describedBy('title')}
          className={inputClass}
        />
        <FieldError id={`${id('title')}-error`} message={errors.title} />
      </div>
      <div>
        <label htmlFor={id('description')} className={labelClass}>
          Description
        </label>
        <textarea
          id={id('description')}
          name="description"
          rows={3}
          maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
          defaultValue={values.description}
          aria-invalid={invalid('description')}
          aria-describedby={describedBy('description')}
          className={inputClass}
        />
        <FieldError id={`${id('description')}-error`} message={errors.description} />
      </div>
      <div>
        <label htmlFor={id('location')} className={labelClass}>
          Location
        </label>
        <input
          id={id('location')}
          name="location"
          required
          maxLength={200}
          defaultValue={values.location}
          aria-invalid={invalid('location')}
          aria-describedby={describedBy('location')}
          className={inputClass}
        />
        <FieldError id={`${id('location')}-error`} message={errors.location} />
      </div>
      <div>
        <label htmlFor={id('type')} className={labelClass}>
          Type
        </label>
        <select
          id={id('type')}
          name="type"
          required
          defaultValue={values.type}
          aria-invalid={invalid('type')}
          aria-describedby={describedBy('type')}
          className={inputClass}
        >
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <FieldError id={`${id('type')}-error`} message={errors.type} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id('date')} className={labelClass}>
            Start date
          </label>
          <input
            id={id('date')}
            name="date"
            type="date"
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-invalid={invalid('date')}
            aria-describedby={describedBy('date')}
            className={inputClass}
          />
          <FieldError id={`${id('date')}-error`} message={errors.date} />
        </div>
        <div>
          <label htmlFor={id('endDate')} className={labelClass}>
            End date (optional)
          </label>
          <input
            id={id('endDate')}
            name="endDate"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-invalid={invalid('endDate')}
            aria-describedby={describedBy('endDate', endDateHint)}
            className={inputClass}
          />
          <FieldError id={`${id('endDate')}-error`} message={errors.endDate} />
        </div>
      </div>
      <p id={endDateHint} className={`-mt-2 ${mutedTextClass}`}>
        Leave the end date blank for a one-day event.
      </p>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Time slots</legend>
        <TimeSlotEditor
          idPrefix={idPrefix}
          initialSlots={values.slots}
          errors={errors}
          eventStart={startDate}
          eventEnd={endDate}
          onCountChange={setSlotCount}
        />
      </fieldset>

      {slotCount === 0 && (
        <div>
          <label htmlFor={id('time')} className={labelClass}>
            Time (optional)
          </label>
          <input
            id={id('time')}
            name="time"
            maxLength={100}
            defaultValue={values.time}
            placeholder="6:00 PM – 9:00 PM"
            aria-invalid={invalid('time')}
            aria-describedby={describedBy('time', timeHint)}
            className={inputClass}
          />
          <FieldError id={`${id('time')}-error`} message={errors.time} />
          <p id={timeHint} className={`mt-1 ${mutedTextClass}`}>
            Shown as written. Adding a time slot replaces it.
          </p>
        </div>
      )}

      <div>
        <label htmlFor={id('capacity')} className={labelClass}>
          Capacity (optional)
        </label>
        <input
          id={id('capacity')}
          name="capacity"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_EVENT_CAPACITY}
          step={1}
          defaultValue={values.capacity}
          aria-invalid={invalid('capacity')}
          aria-describedby={describedBy('capacity', capacityHint)}
          className={inputClass}
        />
        <FieldError id={`${id('capacity')}-error`} message={errors.capacity} />
        <p id={capacityHint} className={`mt-1 ${mutedTextClass}`}>
          Leave blank for no limit. Members can RSVP until it is full.
        </p>
      </div>
    </>
  )
}

/**
 * The fields remount after each refused save so they pick up the echoed values: React resets
 * uncontrolled fields once an action finishes.
 */
export default function EventForm({
  action,
  initialValues = EMPTY_VALUES,
  submitLabel,
  pendingLabel,
}: {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>
  initialValues?: EventFormValues
  submitLabel: string
  pendingLabel: string
}) {
  const idPrefix = useId()
  const [state, formAction] = useActionState<AttemptState, FormData>(
    async (previous, formData) => ({ ...(await action(previous, formData)), attempt: previous.attempt + 1 }),
    { attempt: 0 },
  )
  const errors = state.errors ?? {}

  return (
    <div className="mt-4 max-w-md space-y-4">
      <ErrorSummary errors={errors} idPrefix={idPrefix} attempt={state.attempt} />
      <form key={state.attempt} action={formAction} className="space-y-4">
        <EventFields idPrefix={idPrefix} values={state.values ?? initialValues} errors={errors} />
        <SubmitButton pendingLabel={pendingLabel} className={primaryButtonClass}>
          {submitLabel}
        </SubmitButton>
      </form>
    </div>
  )
}

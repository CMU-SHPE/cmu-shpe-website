'use client'

import { useEffect, useRef, useState } from 'react'
import { dangerButtonClass, inputClass, labelClass, mutedTextClass, secondaryButtonClass } from '@/components/admin/styles'
import { addDays } from '@/lib/event-dates'
import { MAX_TIME_SLOTS, SLOT_FIELDS, type SlotFormValues } from '@/lib/event-schema'

type SlotField = keyof SlotFormValues

type SlotRow = SlotFormValues & { key: number; errors: Partial<Record<SlotField, string>> }

const SLOT_INPUTS: { field: SlotField; label: string; type: 'date' | 'time' }[] = [
  { field: 'startDate', label: 'From', type: 'date' },
  { field: 'endDate', label: 'To', type: 'date' },
  { field: 'startTime', label: 'Start time', type: 'time' },
  { field: 'endTime', label: 'End time', type: 'time' },
]

export const errorTextClass = 'mt-1 text-sm text-red-700 dark:text-red-400'

export function slotInputId(idPrefix: string, rowKey: number, field: SlotField) {
  return `${idPrefix}-slot-${rowKey}-${field}`
}

/** A new row starts on the day after the previous one ends, or on the event's last day once that is reached. */
function nextSlotDay(rows: SlotRow[], eventStart: string, eventEnd: string) {
  const lastDay = eventEnd || eventStart
  const previousEnd = rows.at(-1)?.endDate
  if (!previousEnd) return eventStart
  const following = addDays(previousEnd, 1)
  return lastDay && following > lastDay ? lastDay : following
}

export default function TimeSlotEditor({
  idPrefix,
  initialSlots,
  errors,
  eventStart,
  eventEnd,
  onCountChange,
}: {
  idPrefix: string
  initialSlots: SlotFormValues[]
  errors: Record<string, string>
  eventStart: string
  eventEnd: string
  onCountChange: (count: number) => void
}) {
  const [rows, setRows] = useState<SlotRow[]>(() =>
    initialSlots.map((slot, index) => ({
      ...slot,
      key: index,
      errors: Object.fromEntries(
        SLOT_INPUTS.flatMap(({ field }) => {
          const message = errors[`slots.${index}.${field}`]
          return message ? [[field, message]] : []
        }),
      ),
    })),
  )
  const nextKey = useRef(initialSlots.length)
  const pendingFocus = useRef<number | 'add' | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const full = rows.length >= MAX_TIME_SLOTS
  const hintId = `${idPrefix}-slots-hint`
  const listError = errors.slots

  useEffect(() => {
    const target = pendingFocus.current
    pendingFocus.current = null
    if (target === 'add') addButton.current?.focus()
    else if (target !== null) document.getElementById(slotInputId(idPrefix, target, 'startDate'))?.focus()
  }, [rows, idPrefix])

  function update(nextRows: SlotRow[]) {
    setRows(nextRows)
    onCountChange(nextRows.length)
  }

  function add() {
    if (full) return
    const day = nextSlotDay(rows, eventStart, eventEnd)
    const key = nextKey.current++
    pendingFocus.current = key
    update([...rows, { key, startDate: day, endDate: day, startTime: '', endTime: '', errors: {} }])
  }

  function remove(index: number) {
    const neighbour = rows[index + 1] ?? rows[index - 1]
    pendingFocus.current = neighbour ? neighbour.key : 'add'
    update(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  function change(index: number, field: SlotField, value: string) {
    setRows(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)))
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <fieldset key={row.key} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">Time slot {index + 1}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {SLOT_INPUTS.map(({ field, label, type }) => {
              const id = slotInputId(idPrefix, row.key, field)
              const error = row.errors[field]
              return (
                <div key={field}>
                  <label htmlFor={id} className={labelClass}>
                    {label}
                  </label>
                  <input
                    id={id}
                    name={SLOT_FIELDS[field]}
                    type={type}
                    required
                    value={row[field]}
                    onChange={(event) => change(index, field, event.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={inputClass}
                  />
                  {error && (
                    <p id={`${id}-error`} className={errorTextClass}>
                      {error}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <button type="button" onClick={() => remove(index)} className={`mt-3 ${dangerButtonClass}`}>
            {'Remove '}
            <span className="sr-only">time slot {index + 1}</span>
          </button>
        </fieldset>
      ))}
      {listError && (
        <p id={`${idPrefix}-slots-error`} className={errorTextClass}>
          {listError}
        </p>
      )}
      <button
        ref={addButton}
        id={`${idPrefix}-add-slot`}
        type="button"
        onClick={add}
        aria-disabled={full || undefined}
        aria-describedby={listError ? `${idPrefix}-slots-error ${hintId}` : hintId}
        className={`${secondaryButtonClass} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
      >
        Add time slot
      </button>
      <p id={hintId} className={mutedTextClass}>
        {full
          ? `That’s the most an event can have (${MAX_TIME_SLOTS}).`
          : 'Optional. Add one slot for each run of days that share the same hours.'}
      </p>
    </div>
  )
}

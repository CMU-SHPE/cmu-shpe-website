import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EventFormState, EventFormValues } from '@/lib/event-form'
import { MAX_TIME_SLOTS } from '@/lib/event-schema'
import EventForm from './event-form'

const hackathon: EventFormValues = {
  title: 'Hackathon',
  description: '',
  location: 'Lab',
  type: 'Workshop',
  date: '2026-10-10',
  endDate: '2026-10-12',
  time: '',
  capacity: '',
  slots: [
    { startDate: '2026-10-10', endDate: '2026-10-11', startTime: '18:00', endTime: '20:00' },
    { startDate: '2026-10-12', endDate: '2026-10-12', startTime: '19:00', endTime: '20:00' },
  ],
}

type Action = (state: EventFormState, formData: FormData) => Promise<EventFormState>

function renderForm(initialValues?: EventFormValues, action = vi.fn<Action>(async () => ({}))) {
  render(<EventForm action={action} initialValues={initialValues} submitLabel="Save" pendingLabel="Saving…" />)
  return action
}

const slot = (number: number) => screen.getByRole('group', { name: `Time slot ${number}` })
const addButton = () => screen.getByRole('button', { name: 'Add time slot' })

describe('EventForm time slots', () => {
  it('pre-fills the start and end dates and every slot when editing', () => {
    renderForm(hackathon)

    expect(screen.getByLabelText('Start date')).toHaveValue('2026-10-10')
    expect(screen.getByLabelText('End date (optional)')).toHaveValue('2026-10-12')
    expect(within(slot(1)).getByLabelText('From')).toHaveValue('2026-10-10')
    expect(within(slot(1)).getByLabelText('To')).toHaveValue('2026-10-11')
    expect(within(slot(1)).getByLabelText('Start time')).toHaveValue('18:00')
    expect(within(slot(2)).getByLabelText('End time')).toHaveValue('20:00')
    expect(screen.queryByLabelText('Time (optional)')).not.toBeInTheDocument()
  })

  it('adds a slot on the start date, the next on the following day, and focuses each new row', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.type(screen.getByLabelText('Start date'), '2026-10-10')
    await user.type(screen.getByLabelText('End date (optional)'), '2026-10-12')

    await user.click(addButton())
    expect(within(slot(1)).getByLabelText('From')).toHaveFocus()
    expect(within(slot(1)).getByLabelText('From')).toHaveValue('2026-10-10')
    expect(within(slot(1)).getByLabelText('To')).toHaveValue('2026-10-10')

    await user.click(addButton())
    expect(within(slot(2)).getByLabelText('From')).toHaveFocus()
    expect(within(slot(2)).getByLabelText('From')).toHaveValue('2026-10-11')

    await user.click(addButton())
    await user.click(addButton())
    expect(within(slot(4)).getByLabelText('From')).toHaveValue('2026-10-12')
  })

  it('hides the free-text time while there are slots and brings it back when the last is removed', async () => {
    const user = userEvent.setup()
    renderForm({ ...hackathon, time: '6 PM', slots: [] })
    expect(screen.getByLabelText('Time (optional)')).toHaveValue('6 PM')

    await user.click(addButton())
    expect(screen.queryByLabelText('Time (optional)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove time slot 1' }))
    expect(screen.getByLabelText('Time (optional)')).toBeInTheDocument()
  })

  it('moves focus to the next row, the previous row, then the add button as rows are removed', async () => {
    const user = userEvent.setup()
    renderForm({
      ...hackathon,
      slots: [...hackathon.slots, { startDate: '2026-10-12', endDate: '2026-10-12', startTime: '21:00', endTime: '22:00' }],
    })

    await user.click(screen.getByRole('button', { name: 'Remove time slot 1' }))
    expect(within(slot(1)).getByLabelText('From')).toHaveFocus()
    expect(within(slot(1)).getByLabelText('To')).toHaveValue('2026-10-12')

    await user.click(screen.getByRole('button', { name: 'Remove time slot 2' }))
    expect(within(slot(1)).getByLabelText('From')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Remove time slot 1' }))
    expect(addButton()).toHaveFocus()
    expect(screen.queryByRole('group', { name: /Time slot \d/ })).not.toBeInTheDocument()
  })

  it('works from the keyboard and lets focus move on past the rows', async () => {
    const user = userEvent.setup()
    renderForm({ ...hackathon, slots: [] })

    addButton().focus()
    await user.keyboard('{Enter}')
    expect(within(slot(1)).getByLabelText('From')).toHaveFocus()

    within(slot(1)).getByRole('button', { name: 'Remove time slot 1' }).focus()
    await user.tab()
    expect(addButton()).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Capacity (optional)')).toHaveFocus()

    within(slot(1)).getByRole('button', { name: 'Remove time slot 1' }).focus()
    await user.keyboard(' ')
    expect(addButton()).toHaveFocus()
  })

  it(`stops at ${MAX_TIME_SLOTS} slots without disabling the focused button`, async () => {
    const user = userEvent.setup()
    renderForm({ ...hackathon, slots: Array.from({ length: MAX_TIME_SLOTS - 1 }, () => hackathon.slots[1]) })

    await user.click(addButton())
    expect(screen.getAllByRole('group', { name: /^Time slot \d+$/ })).toHaveLength(MAX_TIME_SLOTS)
    expect(addButton()).toHaveAttribute('aria-disabled', 'true')
    expect(addButton()).not.toBeDisabled()
    expect(addButton()).toHaveAccessibleDescription(`That’s the most an event can have (${MAX_TIME_SLOTS}).`)

    await user.click(addButton())
    expect(screen.getAllByRole('group', { name: /^Time slot \d+$/ })).toHaveLength(MAX_TIME_SLOTS)
  })

  it('submits the slots in row order', async () => {
    const user = userEvent.setup()
    const action = renderForm(hackathon)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const formData = action.mock.calls[0][1]
    expect(formData.getAll('slotStartDate')).toEqual(['2026-10-10', '2026-10-12'])
    expect(formData.getAll('slotEndTime')).toEqual(['20:00', '20:00'])
    expect(formData.get('endDate')).toBe('2026-10-12')
    expect(formData.get('time')).toBeNull()
  })

  it('shows refused fields next to their inputs, keeps the typed slots, and focuses a summary', async () => {
    const user = userEvent.setup()
    const action = vi.fn<Action>(
      async (_state, formData) => ({
        errors: {
          endDate: 'The end date must be on or after the start date.',
          'slots.1.startTime': 'This overlaps time slot 1 on the same day.',
        },
        values: { ...hackathon, title: String(formData.get('title')) },
      }),
    )
    renderForm(hackathon, action)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const summary = await screen.findByRole('group', { name: 'There is a problem' })
    await waitFor(() => expect(summary).toHaveFocus())
    expect(within(summary).getByRole('link', { name: 'Time slot 2: This overlaps time slot 1 on the same day.' })).toBeInTheDocument()

    const endDate = screen.getByLabelText('End date (optional)')
    expect(endDate).toHaveAttribute('aria-invalid', 'true')
    expect(endDate).toHaveAccessibleDescription(/The end date must be on or after the start date\./)

    const overlapping = within(slot(2)).getByLabelText('Start time')
    expect(overlapping).toHaveAttribute('aria-invalid', 'true')
    expect(overlapping).toHaveAccessibleDescription('This overlaps time slot 1 on the same day.')
    expect(overlapping).toHaveValue('19:00')
    expect(within(slot(1)).getByLabelText('Start time')).not.toHaveAttribute('aria-invalid')
  })
})

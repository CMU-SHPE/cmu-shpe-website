import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mocks = vi.hoisted(() => ({
  listReceiptsForSponsor: vi.fn(),
  uploadSponsorReceipt: vi.fn(),
  deleteSponsorReceipt: vi.fn(),
}))
vi.mock('@/lib/receipts', () => ({ listReceiptsForSponsor: mocks.listReceiptsForSponsor }))
vi.mock('@/app/admin/sponsors/[id]/receipts/actions', () => ({
  uploadSponsorReceipt: mocks.uploadSponsorReceipt,
  deleteSponsorReceipt: mocks.deleteSponsorReceipt,
}))

import AdminSponsorReceipts from './sponsor-receipts'

beforeEach(() => {
  mocks.listReceiptsForSponsor.mockReset().mockResolvedValue([
    {
      id: 12,
      title: 'Gold 2026',
      receiptDate: '2026-09-01',
      fileName: 'gold.pdf',
      byteSize: 2048,
      uploadedBy: 'Max',
      createdAt: new Date(),
    },
  ])
  mocks.uploadSponsorReceipt.mockReset().mockResolvedValue({ status: 'uploaded' })
  mocks.deleteSponsorReceipt.mockReset().mockResolvedValue({ status: 'deleted' })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

async function fillUpload(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Title'), 'Silver 2026')
  await user.type(screen.getByLabelText('Receipt date'), '2026-10-01')
  const file = screen.getByLabelText('PDF file')
  await user.upload(file, new File(['%PDF-1.7'], 'silver.pdf', { type: 'application/pdf' }))
  // jsdom's constraint validation can't see files set by user-event and would block the submit.
  file.removeAttribute('required')
}

describe('AdminSponsorReceipts', () => {
  it('lists the listing’s receipts with admin download links', async () => {
    render(await AdminSponsorReceipts({ sponsorId: 3 }))

    expect(mocks.listReceiptsForSponsor).toHaveBeenCalledWith(3)
    const section = screen.getByRole('region', { name: 'Receipts' })
    const table = within(section).getByRole('table')
    expect(within(table).getByRole('link', { name: 'gold.pdf' })).toHaveAttribute('href', '/admin/sponsors/3/receipts/12')
    expect(within(table).getByText('Uploaded by Max')).toBeInTheDocument()
    expect(within(table).getByText('2 KB')).toBeInTheDocument()
  })

  it('asks the browser for PDFs only but leaves the check to the server', async () => {
    render(await AdminSponsorReceipts({ sponsorId: 3 }))
    const file = screen.getByLabelText('PDF file')
    expect(file).toHaveAttribute('accept', 'application/pdf,.pdf')
    expect(file).toHaveAccessibleDescription('PDF only, up to 4 MB.')
    expect(screen.getByLabelText('Title')).toBeRequired()
    expect(screen.getByLabelText('Receipt date')).toBeRequired()
  })

  it('uploads with the listing id and announces success', async () => {
    const user = userEvent.setup()
    render(await AdminSponsorReceipts({ sponsorId: 3 }))
    await fillUpload(user)

    await user.click(screen.getByRole('button', { name: 'Upload receipt' }))

    expect(await screen.findByText(/Receipt uploaded/)).toBe(screen.getByRole('status'))
    const [sponsorId, , formData] = mocks.uploadSponsorReceipt.mock.calls[0] as [number, unknown, FormData]
    expect(sponsorId).toBe(3)
    expect(formData.get('title')).toBe('Silver 2026')
    expect(formData.get('date')).toBe('2026-10-01')
  })

  it('explains a refused upload, marks the file invalid and keeps the typed details', async () => {
    mocks.uploadSponsorReceipt.mockResolvedValue({ status: 'type' })
    const user = userEvent.setup()
    render(await AdminSponsorReceipts({ sponsorId: 3 }))
    await fillUpload(user)

    await user.click(screen.getByRole('button', { name: 'Upload receipt' }))

    expect(await screen.findByRole('status')).toHaveTextContent('That file is not a PDF.')
    expect(screen.getByLabelText('PDF file')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Title')).toHaveValue('Silver 2026')
    expect(screen.getByLabelText('Receipt date')).toHaveValue('2026-10-01')
  })

  it('deletes after confirmation, announces it and returns focus to the heading', async () => {
    const user = userEvent.setup()
    render(await AdminSponsorReceipts({ sponsorId: 3 }))

    await user.click(screen.getByRole('button', { name: 'Delete Gold 2026' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('The sponsor will no longer be able to download it.'))
    expect(mocks.deleteSponsorReceipt).toHaveBeenCalledWith(3, 12)
    expect(await screen.findByRole('status')).toHaveTextContent('Receipt deleted.')
    expect(screen.getByRole('heading', { name: 'Receipts' })).toHaveFocus()
  })

  it('does nothing when the delete is not confirmed', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const user = userEvent.setup()
    render(await AdminSponsorReceipts({ sponsorId: 3 }))

    await user.click(screen.getByRole('button', { name: 'Delete Gold 2026' }))
    expect(mocks.deleteSponsorReceipt).not.toHaveBeenCalled()
  })
})

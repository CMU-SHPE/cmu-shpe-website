import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ listReceiptsForMember: vi.fn() }))
vi.mock('@/lib/receipts', () => ({ listReceiptsForMember: mocks.listReceiptsForMember }))

import SponsorReceiptsList from './receipts-list'

beforeEach(() => {
  mocks.listReceiptsForMember.mockReset().mockResolvedValue([
    { id: 12, title: 'Gold 2026', receiptDate: '2026-09-01', fileName: 'gold.pdf', byteSize: 340 * 1024, createdAt: new Date() },
  ])
})

describe('SponsorReceiptsList', () => {
  it('lists the member’s receipts with download links under a Receipts heading', async () => {
    render(await SponsorReceiptsList({ memberId: 7 }))

    expect(mocks.listReceiptsForMember).toHaveBeenCalledWith(7)
    const section = screen.getByRole('region', { name: 'Receipts' })
    const table = within(section).getByRole('table', { name: 'Receipts for your sponsorship, newest first' })
    expect(within(table).getByText('September 1, 2026')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: 'Download Gold 2026 (PDF, 340 KB)' })).toHaveAttribute(
      'href',
      '/sponsor/receipts/12',
    )
  })

  it('says when there are no receipts yet', async () => {
    mocks.listReceiptsForMember.mockResolvedValue([])
    render(await SponsorReceiptsList({ memberId: 7 }))

    expect(screen.getByText('No receipts have been shared with you yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

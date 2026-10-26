'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import SubmitButton from '@/components/submit-button'
import { cardClass, focusRingClass, primaryButtonClass, secondaryButtonClass } from '@/components/admin/styles'
import { accountLinkClass } from '@/components/member/account-shell'
import { unsubscribeFromPage, type UnsubscribeFormState } from './actions'
import { listTopics } from './topic-list'

const RECORDED_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Denver',
  dateStyle: 'medium',
  timeStyle: 'short',
})

function Confirmation({ state }: { state: Extract<UnsubscribeFormState, { status: 'done' }> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => ref.current?.focus(), [])

  return (
    <div ref={ref} tabIndex={-1} className={`space-y-3 text-sm text-gray-700 dark:text-gray-300 ${cardClass} ${focusRingClass}`}>
      {state.removed.length > 0 ? (
        <>
          <p className="font-semibold text-gray-900 dark:text-white">
            You’re unsubscribed from {listTopics(state.removed)}.
          </p>
          {state.recordedAt && (
            <p>
              Recorded on <time dateTime={state.recordedAt}>{RECORDED_TIME.format(new Date(state.recordedAt))} MT</time>.
              You won’t get newsletters on {state.removed.length === 1 ? 'this topic' : 'these topics'} anymore.
            </p>
          )}
        </>
      ) : (
        <p className="font-semibold text-gray-900 dark:text-white">
          You were already unsubscribed{state.scope === 'all' ? ' from all newsletters' : ''}, so nothing changed.
        </p>
      )}
      <p>
        <Link href="/account" className={accountLinkClass}>
          Manage your newsletters
        </Link>{' '}
        (sign-in required).
      </p>
    </div>
  )
}

export default function UnsubscribeForms({
  token,
  inScope,
  others,
}: {
  token: string
  inScope: string[]
  others: string[]
}) {
  const [state, action] = useActionState(unsubscribeFromPage, { status: 'idle' })

  if (state.status === 'done') return <Confirmation state={state} />

  return (
    <div className="space-y-4">
      {state.status === 'invalid' && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          This link doesn’t work anymore. Nothing was changed.
        </p>
      )}

      {inScope.length > 0 && (
        <form action={action} className={`space-y-3 ${cardClass}`}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="scope" value="these" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Stop getting newsletters about {listTopics(inScope)}, the {inScope.length === 1 ? 'topic' : 'topics'} this
            email was sent for.
          </p>
          <SubmitButton pendingLabel="Unsubscribing…" className={primaryButtonClass}>
            Unsubscribe from {listTopics(inScope)}
          </SubmitButton>
        </form>
      )}

      {inScope.length + others.length > 0 && (
        <form action={action} className={`space-y-3 ${cardClass}`}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="scope" value="all" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {others.length > 0
              ? `Or stop every SHPE @ CMU newsletter, including ${listTopics(others)}.`
              : 'Or stop every SHPE @ CMU newsletter you’re subscribed to.'}
          </p>
          <SubmitButton pendingLabel="Unsubscribing…" className={secondaryButtonClass}>
            Unsubscribe from all newsletters
          </SubmitButton>
        </form>
      )}
    </div>
  )
}

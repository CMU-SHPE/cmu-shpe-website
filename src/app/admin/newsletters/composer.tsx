'use client'

import Link from 'next/link'
import { useId, useMemo, useState } from 'react'
import SubmitButton from '@/components/submit-button'
import {
  cardClass,
  focusRingClass,
  inputClass,
  labelClass,
  mutedTextClass,
  primaryButtonClass,
  secondaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import { MAX_NEWSLETTER_BODY_LENGTH, MAX_NEWSLETTER_SUBJECT_LENGTH, PREVIEW_AUDIENCE_NOTICE } from '@/lib/newsletter-limits'
import { renderNewsletter } from '@/lib/newsletter-render'

type Action = (formData: FormData) => void | Promise<void>

export type ComposerTopic = { id: number; name: string; subscriberCount: number }

const MISSING_ADDRESS_PLACEHOLDER = '[Mailing address: add it in Site settings]'

function subscribers(count: number) {
  return count === 1 ? '1 confirmed subscriber' : `${count} confirmed subscribers`
}

export default function Composer({
  draft,
  topics,
  mailingAddress,
  siteUrl,
  adminEmail,
  previewAudienceOnly = false,
  save,
  sendTest,
  review,
}: {
  draft: { subject: string; body: string; topicIds: number[] }
  topics: ComposerTopic[]
  mailingAddress: string
  siteUrl: string
  adminEmail: string
  previewAudienceOnly?: boolean
  save: Action
  sendTest: Action
  review: Action
}) {
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [selected, setSelected] = useState(() => new Set(draft.topicIds))
  const [problem, setProblem] = useState<string | null>(null)
  const ids = useId()
  const canSend = mailingAddress.trim() !== ''

  const preview = useMemo(
    () =>
      renderNewsletter({
        subject,
        body,
        topicNames: topics.filter((topic) => selected.has(topic.id)).map((topic) => topic.name),
        mailingAddress: canSend ? mailingAddress : MISSING_ADDRESS_PLACEHOLDER,
        siteUrl,
        unsubscribe: { sample: true },
      }),
    [subject, body, selected, topics, mailingAddress, canSend, siteUrl],
  )

  function toggle(id: number, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function guardSend(event: React.MouseEvent<HTMLButtonElement>) {
    if (!canSend) {
      event.preventDefault()
      return
    }
    if (subject.trim() === '' || body.trim() === '' || selected.size === 0) {
      event.preventDefault()
      setProblem('To test or send, add a subject, a body and at least one topic.')
      return
    }
    setProblem(null)
  }

  const sendDisabledProps = canSend ? {} : { 'aria-disabled': true, 'aria-describedby': `${ids}-address` }

  return (
    <div className="space-y-6">
      {previewAudienceOnly && (
        <p
          role="note"
          className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-900 dark:text-blue-200"
        >
          {PREVIEW_AUDIENCE_NOTICE}
        </p>
      )}
      {!canSend && (
        <p
          id={`${ids}-address`}
          className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
        >
          Newsletters can’t be sent or tested until the club’s mailing address is filled in. The law (CAN-SPAM)
          requires it at the bottom of every newsletter.{' '}
          <Link href="/admin/settings" className={`font-semibold underline rounded ${focusRingClass}`}>
            Add it in Site settings
          </Link>
          .
        </p>
      )}

      <form className={`${cardClass} space-y-4`} noValidate>
        <label className={labelClass}>
          Subject
          <input
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={MAX_NEWSLETTER_SUBJECT_LENGTH}
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Body
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={14}
            maxLength={MAX_NEWSLETTER_BODY_LENGTH}
            aria-describedby={`${ids}-body-help`}
            className={`${inputClass} font-mono`}
          />
        </label>
        <p id={`${ids}-body-help`} className={mutedTextClass}>
          Plain text. Leave a blank line between paragraphs. Links starting with https:// become clickable. The
          footer with the unsubscribe link and mailing address is added for you.
        </p>

        <fieldset>
          <legend className={labelClass}>Topics (who gets it)</legend>
          {topics.length === 0 ? (
            <p className={`mt-1 ${mutedTextClass}`}>
              There are no topics yet.{' '}
              <Link href="/admin/topics" className={`underline rounded ${focusRingClass}`}>
                Add one first
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {topics.map((topic) => (
                <li key={topic.id}>
                  <label className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
                    <input
                      type="checkbox"
                      name="topicIds"
                      value={topic.id}
                      checked={selected.has(topic.id)}
                      onChange={(event) => toggle(topic.id, event.target.checked)}
                      className={`h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-shpe-red ${focusRingClass}`}
                    />
                    {topic.name}
                    <span className={mutedTextClass}>({subscribers(topic.subscriberCount)})</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <p className={`mt-2 ${mutedTextClass}`}>
            Members subscribed to more than one chosen topic get one copy. The exact number is shown before you send.
          </p>
        </fieldset>

        {problem && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {problem}
          </p>
        )}

        <div className="flex flex-wrap gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <SubmitButton formAction={save} pendingLabel="Saving…" className={secondaryButtonClass}>
            Save draft
          </SubmitButton>
          <SubmitButton
            formAction={sendTest}
            pendingLabel="Sending test…"
            className={secondaryButtonClass}
            onClick={guardSend}
            {...sendDisabledProps}
          >
            Send test to me
          </SubmitButton>
          <SubmitButton
            formAction={review}
            pendingLabel="Saving…"
            className={primaryButtonClass}
            onClick={guardSend}
            {...sendDisabledProps}
          >
            Review and send…
          </SubmitButton>
        </div>
        <p className={mutedTextClass}>
          The test goes to {adminEmail} with “[Test]” before the subject. Every button saves the draft first.
        </p>
      </form>

      <section className={cardClass} aria-labelledby={`${ids}-preview`}>
        <h2 id={`${ids}-preview`} className={sectionHeadingClass}>
          Preview
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Subject: <span className="text-gray-900 dark:text-white">{preview.subject || '(no subject)'}</span>
        </p>
        <iframe
          sandbox=""
          srcDoc={preview.html}
          title="Newsletter preview"
          className="mt-3 h-[32rem] w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
        />
      </section>
    </div>
  )
}

import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import MoveButtons from '@/components/admin/move-buttons'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import { requireAdmin } from '@/lib/admin'
import {
  MAX_TOPIC_DESCRIPTION_LENGTH,
  MAX_TOPIC_NAME_LENGTH,
  getNewsletterTopicsWithSubscriberCounts,
} from '@/lib/newsletter-topics'
import { createTopic, deleteTopic, moveTopic, updateTopic } from './actions'

const errorMessages: Record<string, string> = {
  invalid: `Please check the fields — a topic needs a name of up to ${MAX_TOPIC_NAME_LENGTH} characters, and descriptions can be up to ${MAX_TOPIC_DESCRIPTION_LENGTH} characters.`,
  missing: 'That topic no longer exists.',
  in_use:
    'That topic can’t be deleted while a newsletter that uses it is still being sent. Open the newsletter, press Continue sending until it finishes, then delete the topic.',
}

function TopicFields({ topic }: { topic?: { name: string; description: string } }) {
  return (
    <div className="grid gap-3">
      <label className={labelClass}>
        Name
        <input name="name" required maxLength={MAX_TOPIC_NAME_LENGTH} defaultValue={topic?.name} className={inputClass} />
      </label>
      <label className={labelClass}>
        Description (optional)
        <textarea
          name="description"
          rows={2}
          maxLength={MAX_TOPIC_DESCRIPTION_LENGTH}
          defaultValue={topic?.description}
          className={inputClass}
        />
      </label>
    </div>
  )
}

function subscribers(count: number) {
  return count === 1 ? '1 subscriber' : `${count} subscribers`
}

function deleteWarning(count: number) {
  if (count === 0) return 'No members have chosen it yet.'
  const who = count === 1 ? '1 member has' : `${count} members have`
  return `${who} chosen it; their choice is removed and they will stop getting it.`
}

export default async function AdminTopicsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, topics] = await Promise.all([props.searchParams, getNewsletterTopicsWithSubscriberCounts()])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Newsletter topics</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <section className={cardClass} aria-labelledby="topics-heading">
        <h2 id="topics-heading" className={sectionHeadingClass}>
          Topics
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>
          Members choose which of these they want to hear about, in this order.
        </p>

        {topics.length === 0 ? (
          <p className={`mt-4 ${mutedTextClass}`}>No topics yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {topics.map((topic, index) => (
              <li key={topic.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <p className={`mb-3 ${mutedTextClass}`}>{subscribers(topic.subscriberCount)}</p>
                <form action={updateTopic.bind(null, topic.id)} className="space-y-3">
                  <TopicFields topic={topic} />
                  <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
                    Save<span className="sr-only"> {topic.name}</span>
                  </SubmitButton>
                </form>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                  <MoveButtons
                    name={topic.name}
                    moveUp={index > 0 ? moveTopic.bind(null, topic.id, 'up') : undefined}
                    moveDown={index < topics.length - 1 ? moveTopic.bind(null, topic.id, 'down') : undefined}
                  />
                  <form action={deleteTopic.bind(null, topic.id)}>
                    <DeleteButton
                      name={topic.name}
                      warning={deleteWarning(topic.subscriberCount)}
                    />
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={createTopic} className="mt-6 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add topic</h3>
          <TopicFields />
          <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
            Add topic
          </SubmitButton>
        </form>
      </section>
    </div>
  )
}

import type { Metadata } from 'next'
import SubmitButton from '@/components/submit-button'
import FocusOnMount from '@/components/focus-on-mount'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '@/lib/admin-account'
import { WINDOW_MINUTES } from '@/lib/login-throttle'
import { requireMember } from '@/lib/member'
import { DELETE_CONFIRMATION_WORD, MAX_MEMBER_NAME_LENGTH, getMemberTopicIds } from '@/lib/member-account'
import { getNewsletterTopics } from '@/lib/newsletter-topics'
import { changePassword, deleteAccount, saveTopics, updateName } from './actions'

export const metadata: Metadata = { title: 'Your account | SHPE @ Colorado Mesa University' }

const STATUS_ID = 'account-status'
const throttled = `Too many attempts. Wait ${WINDOW_MINUTES} minutes and try again.`

const errorMessages: Record<string, string> = {
  name: `Enter your name, up to ${MAX_MEMBER_NAME_LENGTH} characters, on one line.`,
  'password-invalid': 'Please enter your current password.',
  'password-password': `New passwords must be at least ${MIN_PASSWORD_LENGTH} characters and at most ${MAX_PASSWORD_BYTES} bytes. Accented letters and emoji count as 2 to 4 bytes each.`,
  'password-mismatch': 'The new password and its confirmation do not match.',
  'password-same': 'Choose a new password that is different from your current one.',
  'password-current': 'Your current password is incorrect.',
  'password-throttled': throttled,
  topics: 'Those newsletter choices could not be saved. The list may have changed; please try again.',
  'delete-invalid': 'Enter your password to delete your account.',
  'delete-confirm': `Type ${DELETE_CONFIRMATION_WORD} in capital letters to confirm.`,
  'delete-current': 'That password is incorrect, so your account was not deleted.',
  'delete-throttled': throttled,
}

const savedMessages: Record<string, string> = {
  name: 'Your name was saved.',
  password: 'Password changed. Any other devices signed in to this account have been signed out.',
  topics: 'Your newsletter choices were saved.',
}

/** Which inputs an error points at, so they can be marked invalid and described by the message. */
const invalidFields: Record<string, string[]> = {
  name: ['name'],
  'password-invalid': ['currentPassword'],
  'password-password': ['newPassword'],
  'password-mismatch': ['confirmPassword'],
  'password-same': ['newPassword'],
  'password-current': ['currentPassword'],
  'delete-invalid': ['deletePassword'],
  'delete-confirm': ['deleteConfirm'],
  'delete-current': ['deletePassword'],
}

export default async function AccountPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  const member = await requireMember()
  const memberId = Number(member.user.id)
  const [{ saved, error }, topics, subscribed] = await Promise.all([
    props.searchParams,
    getNewsletterTopics(),
    getMemberTopicIds(memberId),
  ])
  const subscribedIds = new Set(subscribed)
  const knownSaved = saved && Object.hasOwn(savedMessages, saved) ? saved : undefined
  const hasResult = Boolean(error || knownSaved)
  const invalid = new Set(error && Object.hasOwn(invalidFields, error) ? invalidFields[error] : [])
  const fieldState = (field: string) =>
    invalid.has(field) ? { 'aria-invalid': true as const, 'aria-describedby': STATUS_ID } : {}

  const banner = (
    <StatusBanner
      saved={knownSaved}
      error={error}
      errorMessages={errorMessages}
      savedMessage={knownSaved ? savedMessages[knownSaved] : undefined}
    />
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h1 className={pageHeadingClass}>Your account</h1>
          <p className={`mt-1 ${mutedTextClass}`}>Signed in as {member.user.email}</p>
        </div>

        {hasResult && <FocusOnMount id={STATUS_ID}>{banner}</FocusOnMount>}

        <section className={cardClass} aria-labelledby="name-heading">
          <h2 id="name-heading" className={sectionHeadingClass}>
            Your name
          </h2>
          <form action={updateName} className="mt-4 max-w-md space-y-4">
            <label className={labelClass}>
              Name
              <input
                name="name"
                required
                maxLength={MAX_MEMBER_NAME_LENGTH}
                autoComplete="name"
                defaultValue={member.user.name}
                className={inputClass}
                {...fieldState('name')}
              />
            </label>
            <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
              Save name
            </SubmitButton>
          </form>
        </section>

        <section className={cardClass} aria-labelledby="topics-heading">
          <h2 id="topics-heading" className={sectionHeadingClass}>
            Newsletters
          </h2>
          <p className={`mt-1 ${mutedTextClass}`}>
            Newsletters haven’t started yet; your choices are saved for when they do.
          </p>
          {topics.length === 0 ? (
            <p className={`mt-4 ${mutedTextClass}`}>There are no newsletters to choose from yet.</p>
          ) : (
            <form action={saveTopics} className="mt-4 space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email me about
                </legend>
                {topics.map((topic) => {
                  const descriptionId = `topic-${topic.id}-description`
                  return (
                    <div key={topic.id} className="flex items-start gap-3">
                      <input
                        id={`topic-${topic.id}`}
                        type="checkbox"
                        name="topics"
                        value={topic.id}
                        defaultChecked={subscribedIds.has(topic.id)}
                        aria-describedby={topic.description ? descriptionId : undefined}
                        className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-shpe-red focus:ring-2 focus:ring-shpe-red dark:bg-gray-800"
                      />
                      <div>
                        <label htmlFor={`topic-${topic.id}`} className="text-sm font-medium text-gray-900 dark:text-white">
                          {topic.name}
                        </label>
                        {topic.description && (
                          <p id={descriptionId} className={mutedTextClass}>
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </fieldset>
              <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
                Save newsletter choices
              </SubmitButton>
            </form>
          )}
        </section>

        <section className={cardClass} aria-labelledby="password-heading">
          <h2 id="password-heading" className={sectionHeadingClass}>
            Change password
          </h2>
          <p className={`mt-1 ${mutedTextClass}`}>
            Changing your password keeps you signed in here and signs you out everywhere else.
          </p>
          <form action={changePassword} className="mt-4 max-w-md space-y-4">
            <input type="email" name="username" value={member.user.email ?? ''} autoComplete="username" readOnly hidden />
            <label className={labelClass}>
              Current password
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={200}
                autoComplete="current-password"
                className={inputClass}
                {...fieldState('currentPassword')}
              />
            </label>
            <label className={labelClass}>
              New password ({MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_BYTES} characters)
              <input
                name="newPassword"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_BYTES}
                autoComplete="new-password"
                className={inputClass}
                {...fieldState('newPassword')}
              />
            </label>
            <label className={labelClass}>
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_BYTES}
                autoComplete="new-password"
                className={inputClass}
                {...fieldState('confirmPassword')}
              />
            </label>
            <SubmitButton pendingLabel="Changing…" className={primaryButtonClass}>
              Change password
            </SubmitButton>
          </form>
        </section>

        <section
          className={`${cardClass} border-red-200 dark:border-red-900`}
          aria-labelledby="delete-heading"
        >
          <h2 id="delete-heading" className={sectionHeadingClass}>
            Delete my account
          </h2>
          <p id="delete-explanation" className={`mt-1 ${mutedTextClass}`}>
            This permanently deletes your account and newsletter choices and signs you out. It can’t be undone.
          </p>
          <form action={deleteAccount} className="mt-4 max-w-md space-y-4" aria-describedby="delete-explanation">
            <input type="email" name="username" value={member.user.email ?? ''} autoComplete="username" readOnly hidden />
            <label className={labelClass}>
              Your password
              <input
                name="password"
                type="password"
                required
                maxLength={200}
                autoComplete="current-password"
                className={inputClass}
                {...fieldState('deletePassword')}
              />
            </label>
            <label className={labelClass}>
              Type {DELETE_CONFIRMATION_WORD} to confirm
              <input
                name="confirm"
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className={inputClass}
                {...fieldState('deleteConfirm')}
              />
            </label>
            <SubmitButton pendingLabel="Deleting…" className={dangerButtonClass}>
              Delete my account
            </SubmitButton>
          </form>
        </section>
      </div>
    </div>
  )
}

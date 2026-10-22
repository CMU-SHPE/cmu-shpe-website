import SubmitButton from '@/components/submit-button'
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
import { HTTP_URL_INPUT } from '@/lib/form-fields'
import { getSiteContent, getSiteSettings } from '@/lib/queries'
import { MAX_CONTACT_SUBJECTS, MAX_CONTACT_SUBJECT_LENGTH } from '@/lib/settings-schema'
import { saveSettings } from './actions'

const errorMessages: Record<string, string> = {
  invalid: `Please check the fields — the email must be valid, links must start with http:// or https://, and the subject list needs 1–${MAX_CONTACT_SUBJECTS} options of up to ${MAX_CONTACT_SUBJECT_LENGTH} characters.`,
}

const socialFields = [
  { name: 'instagramUrl', label: 'Instagram' },
  { name: 'linkedinUrl', label: 'LinkedIn' },
  { name: 'xUrl', label: 'X (Twitter)' },
  { name: 'youtubeUrl', label: 'YouTube' },
  { name: 'tiktokUrl', label: 'TikTok' },
  { name: 'presenceUrl', label: 'Presence' },
] as const

export default async function AdminSettingsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, settings, content] = await Promise.all([
    props.searchParams,
    getSiteSettings(),
    getSiteContent(['contact.subjects']),
  ])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Site settings</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <form action={saveSettings} className="space-y-6">
        <section className={cardClass} aria-labelledby="contact-settings-heading">
          <h2 id="contact-settings-heading" className={sectionHeadingClass}>
            Contact and meetings
          </h2>
          <p className={`mt-1 ${mutedTextClass}`}>
            Shown in the footer and on the Contact, Events and Officers pages.
          </p>
          <div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2">
            <label className={`${labelClass} sm:col-span-2`}>
              Contact email
              <input
                name="contactEmail"
                type="email"
                required
                maxLength={320}
                defaultValue={settings?.contactEmail}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Meeting day
              <input
                name="meetingDay"
                required
                maxLength={100}
                defaultValue={settings?.meetingDay}
                placeholder="Thursdays"
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Meeting time
              <input
                name="meetingTime"
                required
                maxLength={100}
                defaultValue={settings?.meetingTime}
                placeholder="5:00 PM"
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Meeting location
              <input
                name="meetingLocation"
                required
                maxLength={200}
                defaultValue={settings?.meetingLocation}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className={cardClass} aria-labelledby="social-settings-heading">
          <h2 id="social-settings-heading" className={sectionHeadingClass}>
            Social links
          </h2>
          <p className={`mt-1 ${mutedTextClass}`}>
            Full links starting with https://. Leave a link blank to hide its icon.
          </p>
          <div className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2">
            {socialFields.map((field) => (
              <label key={field.name} className={labelClass}>
                {field.label}
                <input
                  name={field.name}
                  type="url"
                  maxLength={500}
                  {...HTTP_URL_INPUT}
                  defaultValue={settings?.[field.name] ?? ''}
                  placeholder="https://…"
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </section>

        <section className={cardClass} aria-labelledby="subjects-settings-heading">
          <h2 id="subjects-settings-heading" className={sectionHeadingClass}>
            Contact form subjects
          </h2>
          <label className={`mt-4 max-w-2xl ${labelClass}`}>
            Subject options (one per line)
            <textarea
              name="subjects"
              required
              rows={7}
              maxLength={4000}
              defaultValue={content['contact.subjects']}
              className={inputClass}
            />
          </label>
        </section>

        <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
          Save settings
        </SubmitButton>
      </form>
    </div>
  )
}

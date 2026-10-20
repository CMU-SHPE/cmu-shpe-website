import ContactForm from '@/components/ContactForm'
import Editable from '@/components/editable'
import { InstagramIcon, LinkedInIcon, LocationIcon, PresenceIcon, TikTokIcon, XIcon, YouTubeIcon } from '@/components/icons'
import { currentAdmin } from '@/lib/admin'
import { contentKeysFor } from '@/lib/content-keys'
import { toLines } from '@/lib/lines'
import { getSiteContent, getSiteSettings } from '@/lib/queries'

export default async function Contact() {
  const [content, admin, settings] = await Promise.all([
    getSiteContent(contentKeysFor('contact')),
    currentAdmin(),
    getSiteSettings(),
  ])
  const editable = Boolean(admin)

  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <Editable
              as="span"
              contentKey="contact.header.eyebrow"
              value={content['contact.header.eyebrow']}
              editable={editable}
              className="text-shpe-gold font-semibold text-sm uppercase tracking-widest"
            />
          </div>
          <Editable
            as="h1"
            contentKey="contact.header.heading"
            value={content['contact.header.heading']}
            editable={editable}
            className="text-5xl font-black text-white mb-3"
          />
          <Editable
            as="p"
            contentKey="contact.header.intro"
            value={content['contact.header.intro']}
            editable={editable}
            className="text-gray-300 max-w-xl"
          />
        </div>
      </section>

      {/* ── Form + Info ── */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-14">
            {/* Contact Form */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
              <Editable
                as="h2"
                contentKey="contact.form.heading"
                value={content['contact.form.heading']}
                editable={editable}
                className="text-xl font-bold text-gray-900 dark:text-white mb-6"
              />

              <ContactForm
                email={settings?.contactEmail ?? ''}
                subjects={toLines(content['contact.subjects'])}
              />
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <Editable
                  as="h2"
                  contentKey="contact.info.heading"
                  value={content['contact.info.heading']}
                  editable={editable}
                  className="text-xl font-bold text-gray-900 dark:text-white mb-6"
                />
                <div className="space-y-5">
                  {settings && (
                    <InfoRow
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      }
                      label="Email"
                    >
                      <a
                        href={`mailto:${settings.contactEmail}`}
                        className="text-gray-700 dark:text-gray-300 text-sm hover:text-shpe-red transition-colors"
                      >
                        {settings.contactEmail}
                      </a>
                    </InfoRow>
                  )}
                  <InfoRow icon={<LocationIcon className="w-5 h-5" />} label="Location">
                    <Editable
                      as="div"
                      contentKey="contact.location"
                      value={content['contact.location']}
                      editable={editable}
                      className="text-gray-700 dark:text-gray-300 text-sm"
                    />
                  </InfoRow>
                  {settings && (
                    <InfoRow
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      }
                      label="Weekly Meetings"
                    >
                      <div className="text-gray-700 dark:text-gray-300 text-sm">
                        {`${settings.meetingDay} at ${settings.meetingTime} — ${settings.meetingLocation}`}
                      </div>
                    </InfoRow>
                  )}
                </div>
              </div>

              {/* Social */}
              <div>
                <Editable
                  as="h3"
                  contentKey="contact.social.heading"
                  value={content['contact.social.heading']}
                  editable={editable}
                  className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4"
                />
                <div className="flex gap-4">
                  {settings?.instagramUrl && (
                    <SocialLink href={settings.instagramUrl} label="Instagram" icon={<InstagramIcon />} />
                  )}
                  {settings?.linkedinUrl && (
                    <SocialLink href={settings.linkedinUrl} label="LinkedIn" icon={<LinkedInIcon />} />
                  )}
                  {settings?.xUrl && (
                    <SocialLink href={settings.xUrl} label="X (Twitter)" icon={<XIcon />} />
                  )}
                  {settings?.youtubeUrl && (
                    <SocialLink href={settings.youtubeUrl} label="YouTube" icon={<YouTubeIcon />} />
                  )}
                  {settings?.tiktokUrl && (
                    <SocialLink href={settings.tiktokUrl} label="TikTok" icon={<TikTokIcon />} />
                  )}
                  {settings?.presenceUrl && (
                    <SocialLink href={settings.presenceUrl} label="Presence" icon={<PresenceIcon />} />
                  )}
                </div>
              </div>

              {/* Membership CTA */}
              <div className="bg-cmu-maroon rounded-xl p-6">
                <Editable
                  as="h3"
                  contentKey="contact.join.heading"
                  value={content['contact.join.heading']}
                  editable={editable}
                  className="text-white font-bold text-lg mb-2"
                />
                <Editable
                  as="p"
                  contentKey="contact.join.paragraph"
                  value={content['contact.join.paragraph']}
                  editable={editable}
                  className="text-gray-300 text-sm mb-4 leading-relaxed"
                />
                {settings && (
                  <div className="text-shpe-gold text-sm font-semibold">
                    {settings.meetingDay} @ {settings.meetingTime} · {settings.meetingLocation}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-shpe-red/10 flex items-center justify-center text-shpe-red flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">{label}</div>
        {children}
      </div>
    </div>
  )
}

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-shpe-red hover:text-white text-gray-600 dark:text-gray-300 flex items-center justify-center transition-all duration-200"
    >
      {icon}
    </a>
  )
}

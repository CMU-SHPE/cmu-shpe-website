import ContactForm from '@/components/ContactForm'
import { InstagramIcon, LinkedInIcon, LocationIcon, PresenceIcon, TikTokIcon, XIcon, YouTubeIcon } from '@/components/icons'
import { toLines } from '@/lib/lines'
import { getSiteContent, getSiteSettings } from '@/lib/queries'

export default async function Contact() {
  const [settings, content] = await Promise.all([
    getSiteSettings(),
    getSiteContent(['contact.subjects']),
  ])

  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
              Get in Touch
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">Contact Us</h1>
          <p className="text-gray-300 max-w-xl">
            Questions about membership, sponsorship, or events? We would love to hear from
            you. Reach out and we will get back to you shortly.
          </p>
        </div>
      </section>

      {/* ── Form + Info ── */}
      <section className="bg-gray-50 dark:bg-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-14">
            {/* Contact Form */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Send Us a Message</h2>

              <ContactForm
                email={settings?.contactEmail ?? ''}
                subjects={toLines(content['contact.subjects'])}
              />
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Other Ways to Reach Us</h2>
                <div className="space-y-5">
                  {settings && (
                    <InfoRow
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      }
                      label="Email"
                      value={settings.contactEmail}
                      href={`mailto:${settings.contactEmail}`}
                    />
                  )}
                  <InfoRow
                    icon={<LocationIcon className="w-5 h-5" />}
                    label="Location"
                    value="Colorado Mesa University, Grand Junction, CO"
                  />
                  {settings && (
                    <InfoRow
                      icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      }
                      label="Weekly Meetings"
                      value={`${settings.meetingDay} at ${settings.meetingTime} — ${settings.meetingLocation}`}
                    />
                  )}
                </div>
              </div>

              {/* Social */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                  Follow Us
                </h3>
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
                <h3 className="text-white font-bold text-lg mb-2">Ready to Join?</h3>
                <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                  Membership is open to all CMU students. Come to any Thursday meeting
                  or fill out the form to get in touch and we will get you started.
                </p>
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
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-shpe-red/10 flex items-center justify-center text-shpe-red flex-shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">{label}</div>
        {href ? (
          <a href={href} className="text-gray-700 dark:text-gray-300 text-sm hover:text-shpe-red transition-colors">
            {value}
          </a>
        ) : (
          <div className="text-gray-700 dark:text-gray-300 text-sm">{value}</div>
        )}
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

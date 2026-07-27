'use client'

import { useState, FormEvent } from 'react'
import config from '@/lib/config'
import { InstagramIcon, LinkedInIcon, LocationIcon, PresenceIcon, TikTokIcon, XIcon, YouTubeIcon } from '@/components/icons'

type Status = 'idle' | 'loading' | 'success' | 'error'

const subjects = [
  'General Inquiry',
  'Membership',
  'Sponsorship',
  'Events',
  'Media / Press',
  'Other',
]

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState(subjects[0])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch(config.formspreeEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      })
      setStatus(res.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

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

              {status === 'success' ? (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <h3 className="font-bold text-green-800 dark:text-green-400 text-lg mb-1">Message Sent!</h3>
                  <p className="text-green-700 dark:text-green-500 text-sm">
                    Thanks for reaching out. We will get back to you within a few days.
                  </p>
                  <button
                    onClick={() => {
                      setStatus('idle')
                      setName('')
                      setEmail('')
                      setSubject(subjects[0])
                      setMessage('')
                    }}
                    className="mt-4 text-green-700 dark:text-green-400 text-sm underline hover:text-green-900 dark:hover:text-green-300"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="name">
                      Full Name <span className="text-shpe-red">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="email">
                      Email Address <span className="text-shpe-red">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="subject">
                      Subject
                    </label>
                    <select
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition"
                    >
                      {subjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5" htmlFor="message">
                      Message <span className="text-shpe-red">*</span>
                    </label>
                    <textarea
                      id="message"
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Write your message here..."
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-shpe-red focus:border-transparent transition resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                    />
                  </div>

                  {status === 'error' && (
                    <p className="text-shpe-red text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                      Something went wrong. Please try emailing us directly at {config.email}.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-shpe-red hover:bg-red-700 disabled:opacity-60 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200"
                  >
                    {status === 'loading' ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Other Ways to Reach Us</h2>
                <div className="space-y-5">
                  <InfoRow
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    }
                    label="Email"
                    value={config.email}
                    href={`mailto:${config.email}`}
                  />
                  <InfoRow
                    icon={<LocationIcon className="w-5 h-5" />}
                    label="Location"
                    value="Colorado Mesa University, Grand Junction, CO"
                  />
                  <InfoRow
                    icon={
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    }
                    label="Weekly Meetings"
                    value={`${config.meeting.day} at ${config.meeting.time} — ${config.meeting.location}`}
                  />
                </div>
              </div>

              {/* Social */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                  Follow Us
                </h3>
                <div className="flex gap-4">
                  {config.social.instagram && (
                    <SocialLink href={config.social.instagram} label="Instagram" icon={<InstagramIcon />} />
                  )}
                  {config.social.linkedin && (
                    <SocialLink href={config.social.linkedin} label="LinkedIn" icon={<LinkedInIcon />} />
                  )}
                  {config.social.x && (
                    <SocialLink href={config.social.x} label="X (Twitter)" icon={<XIcon />} />
                  )}
                  {config.social.youtube && (
                    <SocialLink href={config.social.youtube} label="YouTube" icon={<YouTubeIcon />} />
                  )}
                  {config.social.tiktok && (
                    <SocialLink href={config.social.tiktok} label="TikTok" icon={<TikTokIcon />} />
                  )}
                  {config.social.presence && (
                    <SocialLink href={config.social.presence} label="Presence" icon={<PresenceIcon />} />
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
                <div className="text-shpe-gold text-sm font-semibold">
                  {config.meeting.day} @ {config.meeting.time} · {config.meeting.location}
                </div>
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

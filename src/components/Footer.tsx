import Link from 'next/link'
import Editable from '@/components/editable'
import { contentKeysFor } from '@/lib/content-keys'
import { navLinks } from '@/lib/nav'
import { getSiteContent, getSiteSettings } from '@/lib/queries'
import { InstagramIcon, LinkedInIcon, PresenceIcon, TikTokIcon, XIcon, YouTubeIcon } from './icons'

export default async function Footer({ editable }: { editable: boolean }) {
  const [content, settings] = await Promise.all([
    getSiteContent(contentKeysFor('footer')),
    getSiteSettings(),
  ])

  return (
    <footer className="bg-cmu-maroon text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center mb-4 space-x-1">
              <span className="text-shpe-red font-black text-2xl">SHPE</span>
              <span className="text-shpe-gold font-bold text-xl">@</span>
              <span className="text-white font-bold text-lg">CMU</span>
            </div>
            <Editable
              as="p"
              contentKey="footer.tagline"
              value={content['footer.tagline']}
              editable={editable}
              className="text-gray-300 text-sm leading-relaxed"
            />
            <Editable
              as="p"
              contentKey="footer.location"
              value={content['footer.location']}
              editable={editable}
              className="text-gray-400 text-sm mt-3"
            />
          </div>

          {/* Quick Links */}
          <div>
            <Editable
              as="h3"
              contentKey="footer.quickLinks.heading"
              value={content['footer.quickLinks.heading']}
              editable={editable}
              className="text-shpe-gold font-semibold text-xs uppercase tracking-widest mb-4"
            />
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-gray-300 hover:text-shpe-gold text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <Editable
              as="h3"
              contentKey="footer.connect.heading"
              value={content['footer.connect.heading']}
              editable={editable}
              className="text-shpe-gold font-semibold text-xs uppercase tracking-widest mb-4"
            />
            {settings && (
              <>
                <p className="text-gray-300 text-sm mb-1">{settings.contactEmail}</p>
                <p className="text-gray-400 text-sm mb-5">
                  Meetings: {settings.meetingDay} {settings.meetingTime} — {settings.meetingLocation}
                </p>
              </>
            )}
            <div className="flex space-x-4">
              {settings?.instagramUrl && (
                <a href={settings.instagramUrl} aria-label="Instagram" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <InstagramIcon />
                </a>
              )}
              {settings?.linkedinUrl && (
                <a href={settings.linkedinUrl} aria-label="LinkedIn" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <LinkedInIcon />
                </a>
              )}
              {settings?.xUrl && (
                <a href={settings.xUrl} aria-label="X (Twitter)" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <XIcon />
                </a>
              )}
              {settings?.youtubeUrl && (
                <a href={settings.youtubeUrl} aria-label="YouTube" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <YouTubeIcon />
                </a>
              )}
              {settings?.tiktokUrl && (
                <a href={settings.tiktokUrl} aria-label="TikTok" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <TikTokIcon />
                </a>
              )}
              {settings?.presenceUrl && (
                <a href={settings.presenceUrl} aria-label="Presence" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <PresenceIcon />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <Editable
            as="p"
            contentKey="footer.copyright"
            value={content['footer.copyright']}
            editable={editable}
            className="text-gray-400 text-sm"
          />
          <div className="flex items-center gap-6">
            <Link
              href="/login"
              className="text-gray-400 hover:text-shpe-gold text-sm transition-colors duration-200"
            >
              Admin sign in
            </Link>
            <a
              href="https://shpe.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-shpe-gold text-sm transition-colors duration-200"
            >
              SHPE National →
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

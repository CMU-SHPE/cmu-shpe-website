import Link from 'next/link'
import config from '@/lib/config'
import { navLinks } from '@/lib/nav'
import { InstagramIcon, LinkedInIcon, PresenceIcon, TikTokIcon, XIcon, YouTubeIcon } from './icons'

export default function Footer() {
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
            <p className="text-gray-300 text-sm leading-relaxed">
              Society of Hispanic Professional Engineers
              <br />
              Colorado Mesa University Chapter
            </p>
            <p className="text-gray-400 text-sm mt-3">Grand Junction, Colorado</p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-shpe-gold font-semibold text-xs uppercase tracking-widest mb-4">
              Quick Links
            </h3>
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
            <h3 className="text-shpe-gold font-semibold text-xs uppercase tracking-widest mb-4">
              Connect With Us
            </h3>
            <p className="text-gray-300 text-sm mb-1">{config.email}</p>
            <p className="text-gray-400 text-sm mb-5">
              Meetings: {config.meeting.day} {config.meeting.time} — {config.meeting.location}
            </p>
            <div className="flex space-x-4">
              {config.social.instagram && (
                <a href={config.social.instagram} aria-label="Instagram" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <InstagramIcon />
                </a>
              )}
              {config.social.linkedin && (
                <a href={config.social.linkedin} aria-label="LinkedIn" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <LinkedInIcon />
                </a>
              )}
              {config.social.x && (
                <a href={config.social.x} aria-label="X (Twitter)" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <XIcon />
                </a>
              )}
              {config.social.youtube && (
                <a href={config.social.youtube} aria-label="YouTube" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <YouTubeIcon />
                </a>
              )}
              {config.social.tiktok && (
                <a href={config.social.tiktok} aria-label="TikTok" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <TikTokIcon />
                </a>
              )}
              {config.social.presence && (
                <a href={config.social.presence} aria-label="Presence" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-shpe-gold transition-colors duration-200">
                  <PresenceIcon />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm">
            © 2026 SHPE @ Colorado Mesa University. All rights reserved.
          </p>
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
    </footer>
  )
}

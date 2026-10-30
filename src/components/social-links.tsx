import type { ReactNode } from 'react'
import type { SiteSettings } from '@/db/schema'
import { InstagramIcon, LinkedInIcon, MavLifeIcon, TikTokIcon, XIcon, YouTubeIcon } from './icons'

type SocialUrls = Pick<SiteSettings, 'instagramUrl' | 'linkedinUrl' | 'xUrl' | 'youtubeUrl' | 'tiktokUrl' | 'mavlifeUrl'>

export function socialLinks(settings: SocialUrls | null): { label: string; href: string; icon: ReactNode }[] {
  if (!settings) return []
  const links = [
    { label: 'Instagram', href: settings.instagramUrl, icon: <InstagramIcon /> },
    { label: 'LinkedIn', href: settings.linkedinUrl, icon: <LinkedInIcon /> },
    { label: 'X (Twitter)', href: settings.xUrl, icon: <XIcon /> },
    { label: 'YouTube', href: settings.youtubeUrl, icon: <YouTubeIcon /> },
    { label: 'TikTok', href: settings.tiktokUrl, icon: <TikTokIcon /> },
    { label: 'MavLife', href: settings.mavlifeUrl, icon: <MavLifeIcon /> },
  ]
  return links.flatMap((link) => (link.href ? [{ ...link, href: link.href }] : []))
}

export default function SocialLinks({
  settings,
  className,
  linkClassName,
}: {
  settings: SocialUrls | null
  className: string
  linkClassName: string
}) {
  return (
    <div className={className}>
      {socialLinks(settings).map((link) => (
        <a
          key={link.label}
          href={link.href}
          aria-label={link.label}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {link.icon}
        </a>
      ))}
    </div>
  )
}

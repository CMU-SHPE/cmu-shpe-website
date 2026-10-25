'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AdminSection = { href: string; label: string }

const sections: AdminSection[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/settings', label: 'Site settings' },
  { href: '/admin/officers', label: 'Officers' },
  { href: '/admin/sponsors', label: 'Sponsors' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/lists', label: 'Page lists' },
  { href: '/admin/account', label: 'Change password' },
]

const accountSections: AdminSection[] = [{ href: '/admin/admins', label: 'Admin accounts' }]

function isActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function AdminNav({ canCreateAccounts }: { canCreateAccounts: boolean }) {
  const pathname = usePathname()
  const links = canCreateAccounts ? [...sections, ...accountSections] : sections

  return (
    <nav aria-label="Admin" className="md:w-56 md:shrink-0">
      <ul className="flex flex-row flex-wrap gap-1 md:flex-col">
        {links.map((link) => {
          const active = isActive(pathname, link.href)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cmu-maroon dark:focus-visible:ring-shpe-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-gray-800 ${
                  active
                    ? 'bg-cmu-maroon text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900 hover:text-shpe-red dark:hover:text-shpe-gold'
                }`}
              >
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

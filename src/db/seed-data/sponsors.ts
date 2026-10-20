import type { sponsors as sponsorsTable } from '../schema'

export const sponsorRows: (typeof sponsorsTable.$inferInsert)[] = [
  {
    name: 'JGMS',
    tier: 'Platinum',
    website: 'https://www.jgmsinc.com/',
    logoUrl: '/sponsors/jgms.png',
    bgColor: '#ffffff',
    sortOrder: 0,
  },
  {
    name: 'SGM',
    tier: 'Platinum',
    website: 'https://sgm-inc.com/',
    logoUrl: '/sponsors/sgm-inc-logo.svg',
    bgColor: '#555555',
    sortOrder: 1,
  },
]

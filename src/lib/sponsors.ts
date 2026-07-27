export type Tier = 'Platinum' | 'Gold' | 'Silver' | 'Bronze'

export type Sponsor = {
  name: string
  tier: Tier
  website?: string
  logo?: string
  bgColor?: string
  size?: string
}

export const sponsors: Sponsor[] = [
  // ── Platinum ──────────────────────────────────────────
  {
    name: 'JGMS',
    tier: 'Platinum',
    website: 'https://www.jgmsinc.com/',
    logo: '/sponsors/jgms.png',
    // size: 'w-52 h-28',
  },
  {
    name: 'SGM',
    tier: 'Platinum',
    website: 'https://sgm-inc.com/',
    logo: '/sponsors/sgm-inc-logo.svg',
    bgColor: 'bg-sgm-bg',
  },
  // {
  //   name: 'Placeholder Platinum Co.',
  //   tier: 'Platinum',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-platinum-2.png',
  // },

  // ── Gold ──────────────────────────────────────────────
  // {
    // name: 'Placeholder Gold Co.',
    // tier: 'Gold',
    // website: 'https://example.com',
    // logo: '/sponsors/placeholder-gold-2.png',
  // },
  // {
  //   name: 'Placeholder Gold Co.',
  //   tier: 'Gold',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-gold-3.png',
  // },

  // ── Silver ────────────────────────────────────────────
  // {
  //   name: 'Placeholder Silver Co.',
  //   tier: 'Silver',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-silver.png',
  // },
  // {
  //   name: 'Placeholder Silver Co.',
  //   tier: 'Silver',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-silver-2.png',
  // },
  // {
  //   name: 'Placeholder Silver Co.',
  //   tier: 'Silver',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-silver-3.png',
  // },

  // ── Bronze ────────────────────────────────────────────
  // {
  //   name: 'Placeholder Bronze Co.',
  //   tier: 'Bronze',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-bronze.png',
  // },
  // {
  //   name: 'Placeholder Bronze Co.',
  //   tier: 'Bronze',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-bronze-2.png',
  // },
  // {
  //   name: 'Placeholder Bronze Co.',
  //   tier: 'Bronze',
  //   // website: 'https://example.com',
  //   // logo: '/sponsors/placeholder-bronze-3.png',
  // },
]

export const tierOrder: Tier[] = ['Platinum', 'Gold', 'Silver', 'Bronze']

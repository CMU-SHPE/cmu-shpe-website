import type { homePillars, homeStats, nationalStats, sponsorBenefits } from '../schema'

export const homeStatRows: (typeof homeStats.$inferInsert)[] = [
  { value: '25+', label: 'Members', sortOrder: 0 },
  { value: '10+', label: 'Events Per Year', sortOrder: 1 },
  { value: '5+', label: 'Years Active', sortOrder: 2 },
]

export const homePillarRows: (typeof homePillars.$inferInsert)[] = [
  {
    icon: '🎓',
    title: 'Academic Excellence',
    description: 'Tutoring, study groups, and academic resources for STEM students.',
    sortOrder: 0,
  },
  {
    icon: '💼',
    title: 'Career Development',
    description: 'Resume workshops, mock interviews, and career fair prep.',
    sortOrder: 1,
  },
  {
    icon: '🤝',
    title: 'Networking',
    description: 'Connections to professionals, alumni, and industry partners.',
    sortOrder: 2,
  },
  {
    icon: '🌎',
    title: 'Community Service',
    description: 'STEM outreach and service to the Grand Junction community.',
    sortOrder: 3,
  },
]

export const nationalStatRows: (typeof nationalStats.$inferInsert)[] = [
  {
    value: '55,000+',
    label: 'Members Nationwide',
    description: 'Students and professionals across the U.S. and internationally.',
    sortOrder: 0,
  },
  {
    value: '250+',
    label: 'Collegiate Chapters',
    description: 'Active chapters at universities across the country.',
    sortOrder: 1,
  },
  {
    value: 'Est. 1974',
    label: 'Over 50 Years',
    description: 'A legacy of empowering Hispanic STEM professionals.',
    sortOrder: 2,
  },
]

export const sponsorBenefitRows: (typeof sponsorBenefits.$inferInsert)[] = [
  { label: 'Logo on website', platinum: 'yes', gold: 'yes', silver: 'yes', bronze: 'yes', sortOrder: 0 },
  { label: 'Social media features', platinum: 'yes', gold: 'yes', silver: '1', bronze: 'no', sortOrder: 1 },
  { label: 'Logo on event banners', platinum: 'yes', gold: 'yes', silver: 'no', bronze: 'no', sortOrder: 2 },
  { label: 'Newsletter spotlight', platinum: 'yes', gold: 'yes', silver: 'no', bronze: 'no', sortOrder: 3 },
  { label: 'Company presentation', platinum: 'yes', gold: 'no', silver: 'no', bronze: 'no', sortOrder: 4 },
]

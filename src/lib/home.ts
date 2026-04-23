export type Stat = {
  value: string
  label: string
}

export const stats: Stat[] = [
  { value: '10+', label: 'Active Members' },
  { value: '5+', label: 'Events Per Year' },
  { value: '5+', label: 'Years Active' },
  // { value: '+', label: 'Industry Partners' },
]

export type Pillar = {
  icon: string
  title: string
  desc: string
}

export const pillars: Pillar[] = [
  {
    icon: '🎓',
    title: 'Academic Excellence',
    desc: 'Tutoring, study groups, and academic resources for STEM students.',
  },
  {
    icon: '💼',
    title: 'Career Development',
    desc: 'Resume workshops, mock interviews, and career fair prep.',
  },
  {
    icon: '🤝',
    title: 'Networking',
    desc: 'Connections to professionals, alumni, and industry partners.',
  },
  {
    icon: '🌎',
    title: 'Community Service',
    desc: 'STEM outreach and service to the Grand Junction community.',
  },
]

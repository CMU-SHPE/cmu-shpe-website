export const values: string[] = [
  'Excellence in academics and professional pursuits',
  'Celebrating and uplifting Hispanic culture and identity',
  'Building an inclusive and welcoming community for all STEM students',
  'Service to our campus and the broader Grand Junction community',
  'Developing leaders who create lasting impact in their fields',
]

export const joinReasons: string[] = [
  'Access to SHPE scholarships and fellowship opportunities',
  'Connections to Fortune 500 companies and national research labs',
  'Professional development workshops and 1-on-1 mentorship',
  'Opportunity to attend the SHPE National Convention',
  'Leadership and officer positions to build your resume',
  'A community of peers who understand your experience',
]

export type NationalStat = {
  value: string
  label: string
  desc: string
}

export const nationalStats: NationalStat[] = [
  {
    value: '55,000+',
    label: 'Members Nationwide',
    desc: 'Students and professionals across the U.S. and internationally.',
  },
  {
    value: '250+',
    label: 'Collegiate Chapters',
    desc: 'Active chapters at universities across the country.',
  },
  {
    value: 'Est. 1974',
    label: 'Over 50 Years',
    desc: 'A legacy of empowering Hispanic STEM professionals.',
  },
]

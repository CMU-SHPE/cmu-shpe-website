export type Event = {
  id: number
  date: string
  time?: string
  title: string
  description: string
  location: string
  type: string
}

export const typeColors: Record<string, string> = {
  Networking: 'bg-blue-100 text-blue-800',
  Workshop: 'bg-green-100 text-green-800',
  Social: 'bg-purple-100 text-purple-800',
  Academic: 'bg-yellow-100 text-yellow-800',
  Community: 'bg-orange-100 text-orange-800',
  Panel: 'bg-pink-100 text-pink-800',
  Conference: 'bg-indigo-100 text-indigo-800',
}

export const events: Event[] = [
  // {
  //   id: 1,
  //   date: 'April 15, 2026',
  //   time: '6:00 PM – 9:00 PM',
  //   title: 'Spring Networking Night',
  //   description:
  //     'Connect with local industry professionals and alumni over dinner and conversation. Dress business casual. Open to all STEM students.',
  //   location: 'CMU Student Union, Room 214',
  //   type: 'Networking',
  // },
  // {
  //   id: 2,
  //   date: 'April 22, 2026',
  //   time: '5:00 PM – 7:00 PM',
  //   title: 'Resume Workshop',
  //   description:
  //     'Get your resume reviewed by professionals and learn tips to stand out to STEM recruiters. Bring a printed copy if you have one.',
  //   location: 'CMU Engineering Building, Room 105',
  //   type: 'Workshop',
  // },
  // {
  //   id: 3,
  //   date: 'April 30, 2026',
  //   time: '3:00 PM – 5:30 PM',
  //   title: 'Graduate School Info Session',
  //   description:
  //     'Learn about grad school applications, GRE prep, and funding opportunities from faculty and current graduate students.',
  //   location: 'CMU Library, Study Room 3',
  //   type: 'Academic',
  // },
  // {
  //   id: 4,
  //   date: 'May 3, 2026',
  //   time: '6:30 PM – 10:00 PM',
  //   title: 'End of Year Banquet',
  //   description:
  //     "Celebrate the year's achievements, recognize outstanding members, install new officers, and enjoy a formal dinner together.",
  //   location: 'Avalon Theatre, Grand Junction',
  //   type: 'Social',
  // },
  // {
  //   id: 5,
  //   date: 'May 10, 2026',
  //   time: '9:00 AM – 2:00 PM',
  //   title: 'STEM Outreach at Fruita Middle School',
  //   description:
  //     'Volunteers will lead hands-on science and engineering experiments for 6th–8th graders to inspire the next generation.',
  //   location: 'Fruita Middle School',
  //   type: 'Community',
  // },
  // {
  //   id: 6,
  //   date: 'March 22, 2026',
  //   title: 'SHPE Rocky Mountain Regional Conference',
  //   description: 'Six members attended and competed in the regional conference in Denver.',
  //   location: 'University of Denver, Denver CO',
  //   type: 'Conference',
  // },
  // {
  //   id: 7,
  //   date: 'March 8, 2026',
  //   title: 'STEM Outreach at Lincoln Park Elementary',
  //   description: 'Volunteers led hands-on science experiments for 4th and 5th graders.',
  //   location: 'Lincoln Park Elementary School',
  //   type: 'Community',
  // },
  // {
  //   id: 8,
  //   date: 'February 20, 2026',
  //   title: 'Industry Panel: Women in Engineering',
  //   description:
  //     'A panel of women engineers from local and national companies shared career journeys and advice.',
  //   location: 'CMU University Center Ballroom',
  //   type: 'Panel',
  // },
  // {
  //   id: 9,
  //   date: 'February 5, 2026',
  //   title: 'Mock Technical Interview Workshop',
  //   description:
  //     'Members practiced coding and engineering interview questions with professional mentors.',
  //   location: 'CMU Engineering Building, Room 201',
  //   type: 'Workshop',
  // },
  // {
  //   id: 10,
  //   date: 'January 18, 2026',
  //   title: 'Spring Semester Kickoff Mixer',
  //   description:
  //     'Welcomed new and returning members for the spring semester with food, games, and introductions.',
  //   location: 'CMU Student Union Ballroom',
  //   type: 'Social',
  // },
]

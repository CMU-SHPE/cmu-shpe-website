const typeColors: Record<string, string> = {
  Networking: 'bg-blue-100 text-blue-800',
  Workshop: 'bg-green-100 text-green-800',
  Social: 'bg-purple-100 text-purple-800',
  Academic: 'bg-yellow-100 text-yellow-800',
  Community: 'bg-orange-100 text-orange-800',
  Panel: 'bg-pink-100 text-pink-800',
  Conference: 'bg-indigo-100 text-indigo-800',
}

const upcomingEvents = [
  {
    id: 1,
    date: 'April 15, 2026',
    time: '6:00 PM – 9:00 PM',
    title: 'Spring Networking Night',
    description:
      'Connect with local industry professionals and alumni over dinner and conversation. Dress business casual. Open to all STEM students.',
    location: 'CMU Student Union, Room 214',
    type: 'Networking',
  },
  {
    id: 2,
    date: 'April 22, 2026',
    time: '5:00 PM – 7:00 PM',
    title: 'Resume Workshop',
    description:
      'Get your resume reviewed by professionals and learn tips to stand out to STEM recruiters. Bring a printed copy if you have one.',
    location: 'CMU Engineering Building, Room 105',
    type: 'Workshop',
  },
  {
    id: 3,
    date: 'April 30, 2026',
    time: '3:00 PM – 5:30 PM',
    title: 'Graduate School Info Session',
    description:
      'Learn about grad school applications, GRE prep, and funding opportunities from faculty and current graduate students.',
    location: 'CMU Library, Study Room 3',
    type: 'Academic',
  },
  {
    id: 4,
    date: 'May 3, 2026',
    time: '6:30 PM – 10:00 PM',
    title: 'End of Year Banquet',
    description:
      "Celebrate the year's achievements, recognize outstanding members, install new officers, and enjoy a formal dinner together.",
    location: 'Avalon Theatre, Grand Junction',
    type: 'Social',
  },
  {
    id: 5,
    date: 'May 10, 2026',
    time: '9:00 AM – 2:00 PM',
    title: 'STEM Outreach at Fruita Middle School',
    description:
      'Volunteers will lead hands-on science and engineering experiments for 6th–8th graders to inspire the next generation.',
    location: 'Fruita Middle School',
    type: 'Community',
  },
]

const pastEvents = [
  {
    id: 6,
    date: 'March 22, 2026',
    title: 'SHPE Rocky Mountain Regional Conference',
    description: 'Six members attended and competed in the regional conference in Denver.',
    location: 'University of Denver, Denver CO',
    type: 'Conference',
  },
  {
    id: 7,
    date: 'March 8, 2026',
    title: 'STEM Outreach at Lincoln Park Elementary',
    description: 'Volunteers led hands-on science experiments for 4th and 5th graders.',
    location: 'Lincoln Park Elementary School',
    type: 'Community',
  },
  {
    id: 8,
    date: 'February 20, 2026',
    title: 'Industry Panel: Women in Engineering',
    description:
      'A panel of women engineers from local and national companies shared career journeys and advice.',
    location: 'CMU University Center Ballroom',
    type: 'Panel',
  },
  {
    id: 9,
    date: 'February 5, 2026',
    title: 'Mock Technical Interview Workshop',
    description:
      'Members practiced coding and engineering interview questions with professional mentors.',
    location: 'CMU Engineering Building, Room 201',
    type: 'Workshop',
  },
  {
    id: 10,
    date: 'January 18, 2026',
    title: 'Spring Semester Kickoff Mixer',
    description:
      'Welcomed new and returning members for the spring semester with food, games, and introductions.',
    location: 'CMU Student Union Ballroom',
    type: 'Social',
  },
]

export default function Events() {
  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
              Stay in the Loop
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">Events</h1>
          <p className="text-gray-300 max-w-xl">
            From workshops and networking nights to community service and conferences —
            there is always something happening with CMU SHPE.
          </p>
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-10">
            <div className="h-0.5 w-8 bg-shpe-red mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200 flex"
              >
                {/* Left accent bar */}
                <div className="w-1.5 bg-shpe-red flex-shrink-0" />
                <div className="p-6 flex-1">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${typeColors[event.type]}`}
                    >
                      {event.type}
                    </span>
                    <div className="text-right">
                      <div className="text-gray-700 text-sm font-medium">{event.date}</div>
                      <div className="text-gray-400 text-xs">{event.time}</div>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{event.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4">{event.description}</p>
                  <div className="flex items-center text-gray-400 text-xs">
                    <svg
                      className="w-3.5 h-3.5 mr-1.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {event.location}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Past Events ── */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-10">
            <div className="h-0.5 w-8 bg-gray-400 mr-3" />
            <h2 className="text-2xl font-bold text-gray-700">Past Events</h2>
          </div>

          <div className="space-y-4">
            {pastEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4 opacity-80"
              >
                <div className="sm:w-32 flex-shrink-0">
                  <div className="text-gray-400 text-sm">{event.date}</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-gray-700">{event.title}</h3>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColors[event.type]}`}
                    >
                      {event.type}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm">{event.description}</p>
                </div>
                <div className="text-gray-400 text-xs sm:text-right flex-shrink-0">
                  {event.location}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stay Updated ── */}
      <section className="bg-shpe-red py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Never Miss an Event</h2>
          <p className="text-red-100 mb-6">
            Follow us on social media or reach out to be added to our mailing list.
          </p>
          <a
            href="mailto:shpe@coloradomesa.edu"
            className="inline-flex items-center justify-center bg-white text-shpe-red hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-all duration-200"
          >
            shpe@coloradomesa.edu
          </a>
        </div>
      </section>
    </div>
  )
}

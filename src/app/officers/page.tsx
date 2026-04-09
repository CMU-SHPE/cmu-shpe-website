const officers = [
  {
    name: 'Jeff Torres Navarrete',
    role: 'President',
    major: 'Mechanical Engineering',
    year: 'Sophomore',
    bio: 'Leading our chapter with a passion for increasing Hispanic representation in tech and engineering.',
    email: 'jytorresnavarr@mavs.coloradomesa.edu',
    // photo: '/officers/jeff-torres-navarrete.jpg',
  },
  {
    name: 'Magaly Luna',
    role: 'Outgoing President',
    major: 'Electrical Engineering',
    year: 'Senior',
    bio: 'Served as chapter President. Now mentoring incoming leadership to ensure a seamless transition.',
    email: 'mluna2@mavs.coloradomesa.edu',
    // photo: '/officers/magaly-luna.jpg',
  },
  {
    name: 'Sergio Zazueta',
    role: 'Vice President',
    major: 'Mechanical Engineering Technology',
    year: 'Junior',
    bio: "Coordinates events and supports the President in executing our chapter's vision.",
    email: 'szazueta@mavs.coloradomesa.edu',
    // photo: '/officers/sergio-zazueta.jpg',
  },
  // {
  //   name: 'Adrien',
  //   role: 'Secretary',
  //   major: 'Civil Engineering',
  //   year: 'Sophomore',
  //   bio: 'Keeps our chapter organized through meeting notes, communications, and member records.',
  // },
  {
    name: 'Jayden Alonzo-Estrada',
    role: 'Treasurer',
    major: 'Electrical Engineering',
    year: 'Junior',
    bio: 'Manages chapter finances and ensures our funds are used effectively for member programming.',
    email: 'jjalonzo-estra@mavs.coloradomesa.edu',
    photo: '/officers/jayden-alonzo-estrada.jpg',
  },
  // {
  //   name: 'Carlos Ramirez',
  //   role: 'Webmaster',
  //   major: 'Computer Science',
  //   year: 'Sophomore',
  //   bio: 'Maintains our digital presence and helps members stay informed about opportunities.',
  // },
  // {
  //   name: 'Maria Lopez',
  //   role: 'Professional Development Chair',
  //   major: 'Chemical Engineering',
  //   year: 'Senior',
  //   bio: 'Plans workshops, industry visits, and professional development events for our members.',
  // },
  // {
  //   name: 'Luis Garcia',
  //   role: 'Community Service Chair',
  //   major: 'Mechanical Engineering',
  //   year: 'Junior',
  //   bio: 'Organizes STEM outreach initiatives and community service opportunities for our chapter.',
  // },
  // {
  //   name: 'Ana Flores',
  //   role: 'Historian',
  //   major: 'Computer Science',
  //   year: 'Freshman',
  //   bio: 'Documents chapter events through photography, social media, and our chapter archive.',
  // },
]

const advisor = {
  name: 'Ulises Techera',
  role: 'Instructor',
  department: 'CMU/CU Boulder Civil Engineering',
  bio: 'Dr. Techera has been advising the CMU SHPE chapter for many years. His mentorship and support have been instrumental to our growth.',
  email: 'utechera@coloradomesa.edu',
  photo: undefined as string | undefined,
  // Uncomment and set when photo is ready:
  // photo: '/officers/ulises-techera.jpg',
}

import OfficerAvatar from '@/components/OfficerAvatar'

export default function Officers() {
  return (
    <div>
      {/* ── Page Header ── */}
      <section className="bg-cmu-maroon py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-4">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <span className="text-shpe-gold font-semibold text-sm uppercase tracking-widest">
              Meet the Team
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-3">Chapter Officers</h1>
          <p className="text-gray-300 max-w-xl">
            Our executive board is elected each spring and works year-round to create
            opportunities and community for CMU SHPE members.
          </p>
        </div>
      </section>

      {/* ── Executive Board ── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-12">
            <div className="h-0.5 w-8 bg-shpe-red mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Executive Board 2025–2026</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {officers.map((officer) => (
              <div
                key={officer.name}
                className="bg-gray-50 rounded-xl p-6 text-center border border-gray-100 hover:border-shpe-red/30 hover:shadow-md transition-all duration-200"
              >
                <OfficerAvatar name={officer.name} photo={officer.photo} />
                <h3 className="font-bold text-gray-900 text-base mb-0.5">{officer.name}</h3>
                <p className="text-shpe-red font-semibold text-sm mb-2">{officer.role}</p>
                <p className="text-gray-500 text-xs mb-1">{officer.major}</p>
                <p className="text-gray-400 text-xs mb-4">{officer.year}</p>
                <p className="text-gray-500 text-xs leading-relaxed mb-4">{officer.bio}</p>
                {officer.email && (
                  <a
                    href={`mailto:${officer.email}`}
                    className="text-shpe-red hover:text-red-700 text-xs font-medium transition-colors break-all"
                  >
                    {officer.email}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Faculty Advisor ── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-10">
            <div className="h-0.5 w-8 bg-shpe-gold mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">Faculty Advisor</h2>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-2xl flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="flex-shrink-0">
              <OfficerAvatar name={advisor.name} photo={advisor.photo} size="lg" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-xl mb-0.5">{advisor.name}</h3>
              <p className="text-shpe-red font-semibold text-sm mb-1">{advisor.role}</p>
              <p className="text-gray-500 text-sm mb-4">{advisor.department}</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{advisor.bio}</p>
              <a
                href={`mailto:${advisor.email}`}
                className="text-shpe-red hover:text-red-700 text-sm font-medium transition-colors"
              >
                {advisor.email}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Elections Info ── */}
      <section className="bg-shpe-red py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Interested in Running for Office?</h2>
          <p className="text-red-100 mb-6 max-w-xl mx-auto">
            Officer elections are held each spring semester. Any dues-paying member in good
            academic standing is eligible to run. Leadership experience not required — just
            dedication and a desire to serve.
          </p>
          <p className="text-red-200 text-sm">
            Contact us at{' '}
            <a
              href="mailto:shpe@coloradomesa.edu"
              className="text-white underline hover:text-red-100"
            >
              shpe@coloradomesa.edu
            </a>{' '}
            to learn more.
          </p>
        </div>
      </section>
    </div>
  )
}

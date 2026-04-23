export type Officer = {
  name: string
  role: string
  major: string
  year: string
  bio: string
  email?: string
  photo?: string
  linkedin?: string
}

export type Advisor = {
  name: string
  role: string
  department: string
  bio: string
  email?: string
  photo?: string
  linkedin?: string
}

export const officers: Officer[] = [
  {
    name: 'Jeff Torres Navarrete',
    role: 'Co-President',
    major: 'Mechanical Engineering',
    year: 'Sophomore',
    bio: 'Leading our chapter with a passion for increasing Hispanic representation in tech and engineering.',
    email: 'jytorresnavarr@mavs.coloradomesa.edu',
    photo: '/officers/jeff.jpg',
    linkedin: 'https://www.linkedin.com/in/jtorresn/',
  },
  {
    name: 'Magaly Luna',
    role: 'Co-President',
    major: 'Electrical and Computer Engineering',
    year: 'Senior',
    bio: 'Served as chapter President. Now mentoring incoming leadership to ensure a seamless transition.',
    email: 'mluna2@mavs.coloradomesa.edu',
    photo: '/officers/magaly.jpg',
    linkedin: 'https://www.linkedin.com/in/luna05/',
  },
  {
    name: 'Sergio Zazueta',
    role: 'Vice President',
    major: 'Mechanical Engineering Technology',
    year: 'Junior',
    bio: "Coordinates events and supports the President in executing our chapter's vision.",
    email: 'szazueta@mavs.coloradomesa.edu',
    photo: '/officers/sergio.jpg',
    linkedin: 'https://www.linkedin.com/in/sergio-zazueta-486719330/',
  },
  {
    name: 'Jayden Alonzo-Estrada',
    role: 'Treasurer',
    major: 'Computer Science and Cybersecurity',
    year: 'Senior',
    bio: 'Manages chapter finances and ensures our funds are used effectively for member programming.',
    email: 'jjalonzo-estra@mavs.coloradomesa.edu',
    photo: '/officers/jayden.jpg',
    linkedin: 'https://www.linkedin.com/in/jayae/',
  },
  {
    name: 'Jesus Lopez',
    role: 'Secretary',
    major: 'Mechanical Engineering',
    year: 'Sophomore',
    bio: 'Keeps our chapter organized through meeting notes, communications, and member records.',
    email: 'jlopez-rodrig@mavs.coloradomesa.edu',
    linkedin: 'https://www.linkedin.com/in/jesus-lopez-134673389/',
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

export const advisor: Advisor = {
  name: 'Ulises Techera',
  role: 'Instructor',
  department: 'CMU/CU Boulder Civil Engineering',
  bio: 'Dr. Techera has been advising the CMU SHPE chapter for many years. His mentorship and support have been instrumental to our growth.',
  email: 'utechera@coloradomesa.edu',
  photo: '/officers/ulises.jpg',
  linkedin: 'https://www.linkedin.com/in/ulises-d-techera-ph-d-172a85b9/',
}

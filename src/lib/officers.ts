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
    year: 'Junior',
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
    year: 'Junior',
    bio: 'Keeps our chapter organized through meeting notes, communications, and member records.',
    email: 'jlopez-rodrig@mavs.coloradomesa.edu',
    linkedin: 'https://www.linkedin.com/in/jesus-lopez-134673389/',
  },
  {
    name: 'Daniel Hernandez',
    role: 'CAB Representative',
    major: 'Civil Engineering',
    year: 'Junior',
    bio: 'Manages our chapter\'s relationship with the Club Advisory Board and helps coordinate campus-wide events.',
    email: 'dhernandez5@mavs.coloradomesa.edu',
    // photo: '/officers/daniel.jpg',
    linkedin: 'https://www.linkedin.com/in/daniel-hernandez-4b1872405/',
  },
  {
    name: 'Randy Martinez',
    role: 'Photographer',
    major: 'Mechanical Engineering',
    year: 'Junior',
    bio: 'Documenting our chapter\'s events and activities through photography to share with our members and the community.',
    email: 'rmartinez@mavs.coloradomesa.edu',
    // photo: '/officers/randy.jpg',
    // linkedin: 'https://www.linkedin.com/in/randy-martinez-4b1872405/',
  },
  {
    name: 'Adrian Valencia',
    role: 'Outreach Chair',
    major: 'Electrical and Computer Engineering',
    year: 'Junior',
    bio: 'Leads outreach efforts to connect CMU SHPE with local STEM programs and the broader Grand Junction community.',
    email: 'avalencia2@mavs.coloradomesa.edu',
  },
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

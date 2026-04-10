const config: {
  email: string
  meeting: { day: string; time: string; location: string }
  social: {
    instagram?: string
    linkedin?: string
    x?: string
    youtube?: string
    tiktok?: string
  }
} = {
  email: 'shpecmu9@gmail.com',
  meeting: {
    day: 'Thursdays',
    time: '5:00 PM',
    location: 'Confluence 305',
  },
  social: {
    instagram: 'https://www.instagram.com/shpecmu.mavs',
    linkedin: 'https://www.linkedin.com/in/cmu-shpe-8019013b6/',
    // x: 'https://x.com/cmu_shpe',
    // youtube: 'https://youtube.com/@cmu_shpe',
    tiktok: 'https://www.tiktok.com/@shpecmu.mavs',
  },
}

export default config

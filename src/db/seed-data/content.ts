import type { ContentKey } from '@/lib/content-keys'

export const contentDefaults = {
  'home.hero.eyebrow': 'Colorado Mesa University',
  'home.hero.subtitle': 'Society of Hispanic Professional Engineers',
  'home.hero.intro':
    'Empowering the next generation of Hispanic STEM leaders through community, professional development, and academic excellence at Colorado Mesa University.',
  'home.mission.eyebrow': 'Our Mission',
  'home.mission.heading': 'Building the Future of Hispanic Engineering',
  'home.mission.paragraph1':
    'The CMU SHPE chapter brings together Hispanic and underrepresented STEM students in Grand Junction, providing the tools, resources, and network needed to thrive in engineering and science careers.',
  'home.mission.paragraph2':
    "Through professional development events, industry networking, and community service, our members grow into the engineers and scientists who will shape tomorrow's world.",
  'home.events.eyebrow': "What's Coming Up",
  'home.events.heading': 'Upcoming Events',
  'home.sponsors.eyebrow': 'Our Partners',
  'home.sponsors.heading': 'Sponsors & Partners',
  'home.sponsors.intro':
    'Our generous sponsors make our programs and events possible. We are grateful for their commitment to developing Hispanic STEM talent.',
  'home.cta.heading': 'Ready to Join SHPE?',
  'home.cta.paragraph':
    'Become part of a community that will help you grow as an engineer, expand your network, and make a lasting impact. All STEM students are welcome.',

  'about.header.eyebrow': 'Who We Are',
  'about.header.heading': 'About Our Chapter',
  'about.header.intro':
    'Learn about the CMU SHPE chapter, our mission, and the national organization we are proud to be part of.',
  'about.chapter.heading': 'Colorado Mesa University Chapter',
  'about.chapter.paragraph1':
    'The SHPE chapter at Colorado Mesa University was founded to bring together Hispanic and underrepresented students in STEM disciplines and provide them with the tools, resources, and network they need to succeed.',
  'about.chapter.paragraph2':
    "Located in Grand Junction, Colorado, our chapter serves students from CMU's engineering, computer science, mathematics, and physical sciences programs. We are proud to be one of the active SHPE collegiate chapters in the state of Colorado.",
  'about.chapter.paragraph3':
    'Our members gain access to national SHPE resources, including the annual SHPE National Convention — one of the largest gatherings of Hispanic STEM professionals and students in the country.',
  'about.quote.text':
    '“Changing lives by empowering the Hispanic community to realize its fullest potential and to impact the world through STEM awareness, access, support, and development.”',
  'about.quote.cite': '— SHPE National Mission',
  'about.values.heading': 'Our Values',
  'about.values.items': [
    'Excellence in academics and professional pursuits',
    'Celebrating and uplifting Hispanic culture and identity',
    'Building an inclusive and welcoming community for all STEM students',
    'Service to our campus and the broader Grand Junction community',
    'Developing leaders who create lasting impact in their fields',
  ].join('\n'),
  'about.joinReasons.heading': 'Why Join SHPE?',
  'about.joinReasons.items': [
    'Access to SHPE scholarships and fellowship opportunities',
    'Connections to Fortune 500 companies and national research labs',
    'Professional development workshops and 1-on-1 mentorship',
    'Opportunity to attend the SHPE National Convention',
    'Leadership and officer positions to build your resume',
    'A community of peers who understand your experience',
  ].join('\n'),
  'about.national.eyebrow': 'The Bigger Picture',
  'about.national.heading': 'About SHPE National',
  'about.national.intro':
    'As a collegiate chapter, we are part of the Society of Hispanic Professional Engineers — a national organization with chapters across the United States.',
  'about.cta.heading': 'Ready to get involved?',
  'about.cta.paragraph':
    'Reach out to learn about membership, upcoming events, and how to join our chapter.',

  'events.header.eyebrow': 'Stay in the Loop',
  'events.header.heading': 'Events',
  'events.header.intro':
    'From workshops and networking nights to community service and conferences — there is always something happening with CMU SHPE.',
  'events.upcoming.heading': 'All Events',
  'events.upcoming.empty': 'No upcoming events right now — check back soon.',
  'events.past.heading': 'Past Events',
  'events.updates.heading': 'Never Miss an Event',
  'events.updates.paragraph':
    'Follow us on social media or reach out to be added to our mailing list.',

  'sponsors.header.eyebrow': 'Our Partners',
  'sponsors.header.heading': 'Sponsors',
  'sponsors.header.intro':
    'Our sponsors are the backbone of CMU SHPE. Their investment directly funds events, travel to conferences, and professional development resources for our members.',
  'sponsors.tier.platinum.amount': '',
  'sponsors.tier.gold.amount': '',
  'sponsors.tier.silver.amount': '',
  'sponsors.tier.bronze.amount': '',
  'sponsors.become.eyebrow': 'Partner With Us',
  'sponsors.become.heading': 'Become a Sponsor',
  'sponsors.become.intro':
    'Investing in CMU SHPE means investing in the next generation of Hispanic engineering talent. Our members are driven, ambitious, and ready to make an impact in your organization.',
  'sponsors.cta.heading': 'Interested in sponsoring?',
  'sponsors.cta.paragraph':
    'Reach out to our President or Faculty Advisor for our full sponsorship prospectus and to discuss a partnership that works for your organization.',

  'officers.header.eyebrow': 'Meet the Team',
  'officers.header.heading': 'Chapter Officers',
  'officers.header.intro':
    'Our executive board is elected each spring and works year-round to create opportunities and community for CMU SHPE members.',
  'officers.board.heading': 'Executive Board 2025–2026',
  'officers.advisor.heading': 'Faculty Advisor',
  'officers.elections.heading': 'Interested in Running for Office?',
  'officers.elections.paragraph':
    'Officer elections are held each spring semester. Any dues-paying member in good academic standing is eligible to run. Leadership experience not required — just dedication and a desire to serve.',

  'contact.header.eyebrow': 'Get in Touch',
  'contact.header.heading': 'Contact Us',
  'contact.header.intro':
    'Questions about membership, sponsorship, or events? We would love to hear from you. Reach out and we will get back to you shortly.',
  'contact.form.heading': 'Send Us a Message',
  'contact.info.heading': 'Other Ways to Reach Us',
  'contact.location': 'Colorado Mesa University, Grand Junction, CO',
  'contact.social.heading': 'Follow Us',
  'contact.join.heading': 'Ready to Join?',
  'contact.join.paragraph':
    'Membership is open to all CMU students. Come to any Thursday meeting or fill out the form to get in touch and we will get you started.',
  'contact.subjects': 'General Inquiry\nMembership\nSponsorship\nEvents\nMedia / Press\nOther',

  'privacy.header.heading': 'Privacy Policy',
  'privacy.updated': 'October 24, 2026',
  'privacy.intro':
    'This policy explains what the Society of Hispanic Professional Engineers chapter at Colorado Mesa University (SHPE @ CMU) collects through this website, why, who helps us handle it, and how you can delete it. We are a student club: we collect as little as we can and never sell your information.',
  'privacy.collect.heading': 'What we collect',
  'privacy.collect.items': [
    'Your name and email address, when you create an account.',
    'Your password in scrambled (hashed) form. We never store or see the password itself.',
    'When you confirmed you are 13 or older and agreed to this policy and our terms, and which version of this policy you agreed to.',
    'Which newsletter topics you choose to receive.',
    'In the future, the club events you RSVP to.',
    'Short-lived records of sign-in, sign-up and password reset attempts (the email address entered and your IP address), used to stop abuse.',
    'Whatever you type into the contact form, when you send us a message.',
  ].join('\n'),
  'privacy.use.heading': 'Why we collect it',
  'privacy.use.items': [
    'To create your account, keep it secure and sign you in.',
    'To send the emails your account needs: confirming your address, password resets and security notices.',
    'To send the newsletters you choose, and only those.',
    'To plan club events and track RSVPs, once that feature launches.',
    'To answer messages you send us.',
    'To protect the site from spam and abuse.',
  ].join('\n'),
  'privacy.processors.heading': 'Who helps us handle it',
  'privacy.processors.intro':
    'These service providers process data only to run this site for us. We don’t sell or share your information with anyone else, including advertisers, unless the law requires it.',
  'privacy.processors.items': [
    'Vercel hosts the website and handles every request you make to it.',
    'Neon hosts our database, which stores your account.',
    'Resend delivers our emails.',
    'Formspree delivers messages sent through the contact form.',
  ].join('\n'),
  'privacy.cookies.heading': 'Cookies',
  'privacy.cookies.body':
    'We only use cookies that are strictly necessary to sign you in and keep you signed in securely, so there is no cookie banner. We don’t use analytics, advertising or tracking cookies. Your light or dark theme choice is saved in your own browser and never sent to us.',
  'privacy.retention.heading': 'How long we keep it',
  'privacy.retention.items': [
    'Your account and newsletter choices: until you delete your account.',
    'Accounts whose email address is never confirmed: deleted after 7 days.',
    'Records of sign-in, sign-up and password reset attempts: used for 15 minutes, then deleted automatically during later sign-in, sign-up or password-reset activity.',
    'Email confirmation links stop working after 24 hours, and password reset links after 1 hour.',
  ].join('\n'),
  'privacy.choices.heading': 'Your choices',
  'privacy.choices.items': [
    'Change which newsletters you receive at any time from your account page.',
    'Delete your account at any time: sign in, open your account page and choose “Delete my account.” Your account and newsletter choices are removed right away.',
    'Ask us for a copy of your information, or to correct it, using the contact details below.',
  ].join('\n'),
  'privacy.children.heading': 'Children',
  'privacy.children.body':
    'This site is not directed to children under 13, and you must be 13 or older to create an account. If you believe a child under 13 has given us information, contact us and we will delete it.',
  'privacy.changes.heading': 'Changes to this policy',
  'privacy.changes.body':
    'If we change this policy, we will update the date at the top of this page. If a change affects how we use information you already gave us, we will email account holders first.',
  'privacy.contact.heading': 'Contact us',
  'privacy.contact.body': 'Questions about your information or this policy? Email us:',

  'terms.header.heading': 'Terms of Use',
  'terms.updated': 'October 24, 2026',
  'terms.intro':
    'These terms cover your use of the SHPE @ Colorado Mesa University website and your account on it. By creating an account you agree to them. They are meant to be short and plain; if anything is unclear, ask us.',
  'terms.accounts.heading': 'Your account',
  'terms.accounts.body':
    'You must be 13 or older to create an account. Use your real name and an email address you control, keep your password to yourself, and tell us if you think someone else has used your account. You are responsible for what happens under your account.',
  'terms.use.heading': 'Acceptable use',
  'terms.use.intro': 'Please use this site the way it is meant to be used. Don’t:',
  'terms.use.items': [
    'Pretend to be someone else, or create accounts for other people without their permission.',
    'Try to get into accounts or parts of the site that aren’t yours.',
    'Send spam, or flood the site with automated requests.',
    'Interfere with the site, or use it for anything illegal or harassing.',
  ].join('\n'),
  'terms.termination.heading': 'Ending your account',
  'terms.termination.body':
    'You can delete your account at any time from your account page. We may suspend or delete an account that breaks these terms, and we may change or shut down the site, for example if the chapter stops running it.',
  'terms.warranty.heading': 'No warranty',
  'terms.warranty.body':
    'This site is run by student volunteers and is provided as is. We do our best to keep it working and accurate, but we can’t promise it will always be available or error-free, and to the extent the law allows we aren’t liable for losses caused by using it.',
  'terms.changes.heading': 'Changes to these terms',
  'terms.changes.body':
    'If we change these terms, we will update the date at the top of this page. Continuing to use your account after a change means you accept the new terms.',
  'terms.contact.heading': 'Contact us',
  'terms.contact.body': 'Questions about these terms? Email us:',

  'footer.tagline': 'Society of Hispanic Professional Engineers\nColorado Mesa University Chapter',
  'footer.location': 'Grand Junction, Colorado',
  'footer.quickLinks.heading': 'Quick Links',
  'footer.connect.heading': 'Connect With Us',
  'footer.copyright': '© 2026 SHPE @ Colorado Mesa University. All rights reserved.',
} satisfies Record<ContentKey, string>

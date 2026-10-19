import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const adminRole = pgEnum('admin_role', ['admin', 'master'])
export const sponsorTier = pgEnum('sponsor_tier', ['Platinum', 'Gold', 'Silver', 'Bronze'])

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: adminRole('role').notNull().default('admin'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    ip: text('ip'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('login_attempts_email_idx').on(table.email, table.createdAt),
    index('login_attempts_ip_idx').on(table.ip, table.createdAt),
  ],
)

export const siteContent = pgTable('site_content', {
  key: text('key').primaryKey(),
  value: text('value').notNull().default(''),
})

export const siteSettings = pgTable('site_settings', {
  id: serial('id').primaryKey(),
  contactEmail: text('contact_email').notNull(),
  meetingDay: text('meeting_day').notNull(),
  meetingTime: text('meeting_time').notNull(),
  meetingLocation: text('meeting_location').notNull(),
  instagramUrl: text('instagram_url'),
  linkedinUrl: text('linkedin_url'),
  xUrl: text('x_url'),
  youtubeUrl: text('youtube_url'),
  tiktokUrl: text('tiktok_url'),
  presenceUrl: text('presence_url'),
})

export const sponsors = pgTable('sponsors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  tier: sponsorTier('tier').notNull(),
  website: text('website'),
  logoUrl: text('logo_url'),
  logoOriginalUrl: text('logo_original_url'),
  logoCrop: text('logo_crop'),
  bgColor: text('bg_color').notNull().default('#ffffff'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const officers = pgTable('officers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  major: text('major').notNull(),
  year: text('year').notNull(),
  bio: text('bio').notNull().default(''),
  email: text('email'),
  linkedin: text('linkedin'),
  photoUrl: text('photo_url'),
  photoOriginalUrl: text('photo_original_url'),
  photoCrop: text('photo_crop'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const advisors = pgTable('advisors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  department: text('department').notNull(),
  bio: text('bio').notNull().default(''),
  email: text('email'),
  linkedin: text('linkedin'),
  photoUrl: text('photo_url'),
  photoOriginalUrl: text('photo_original_url'),
  photoCrop: text('photo_crop'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    location: text('location').notNull(),
    type: text('type').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    time: text('time'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('events_date_idx').on(table.date)],
)

export const homeStats = pgTable('home_stats', {
  id: serial('id').primaryKey(),
  value: text('value').notNull(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const homePillars = pgTable('home_pillars', {
  id: serial('id').primaryKey(),
  icon: text('icon').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const nationalStats = pgTable('national_stats', {
  id: serial('id').primaryKey(),
  value: text('value').notNull(),
  label: text('label').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const sponsorBenefits = pgTable('sponsor_benefits', {
  id: serial('id').primaryKey(),
  label: text('label').notNull(),
  platinum: text('platinum').notNull().default(''),
  gold: text('gold').notNull().default(''),
  silver: text('silver').notNull().default(''),
  bronze: text('bronze').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
})

export type AdminRole = (typeof adminRole.enumValues)[number]
export type SponsorTier = (typeof sponsorTier.enumValues)[number]

export type Admin = typeof admins.$inferSelect
export type LoginAttempt = typeof loginAttempts.$inferSelect
export type SiteContent = typeof siteContent.$inferSelect
export type SiteSettings = typeof siteSettings.$inferSelect
export type Sponsor = typeof sponsors.$inferSelect
export type Officer = typeof officers.$inferSelect
export type Advisor = typeof advisors.$inferSelect
export type ClubEvent = typeof events.$inferSelect
export type HomeStat = typeof homeStats.$inferSelect
export type HomePillar = typeof homePillars.$inferSelect
export type NationalStat = typeof nationalStats.$inferSelect
export type SponsorBenefit = typeof sponsorBenefits.$inferSelect

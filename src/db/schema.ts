import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const adminRole = pgEnum('admin_role', ['admin', 'master'])
export const sponsorTier = pgEnum('sponsor_tier', ['Platinum', 'Gold', 'Silver', 'Bronze'])
export const memberRole = pgEnum('member_role', ['supporter', 'sponsor'])
export const memberTokenPurpose = pgEnum('member_token_purpose', ['confirm_email', 'reset_password'])

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: adminRole('role').notNull().default('admin'),
  canCreateAccounts: boolean('can_create_accounts').notNull().default(false),
  createdBy: integer('created_by').references((): AnyPgColumn => admins.id, { onDelete: 'set null' }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true, mode: 'date' }),
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
  mailingAddress: text('mailing_address').notNull().default(''),
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

export const members = pgTable('members', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: memberRole('role').notNull().default('supporter'),
  emailConfirmedAt: timestamp('email_confirmed_at', { withTimezone: true, mode: 'date' }),
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true, mode: 'date' }),
  ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true, mode: 'date' }).notNull(),
  privacyPolicyVersion: text('privacy_policy_version').notNull(),
  termsAcceptedAt: timestamp('terms_accepted_at', { withTimezone: true, mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const memberTokens = pgTable(
  'member_tokens',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    purpose: memberTokenPurpose('purpose').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('member_tokens_member_purpose_idx').on(table.memberId, table.purpose)],
)

export const newsletterTopics = pgTable('newsletter_topics', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const memberTopicSubscriptions = pgTable(
  'member_topic_subscriptions',
  {
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => newsletterTopics.id, { onDelete: 'cascade' }),
    optedInAt: timestamp('opted_in_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.topicId] })],
)

// Kept apart from login_attempts so spamming /join with an admin's email can't lock that admin out of login.
export const requestThrottle = pgTable(
  'request_throttle',
  {
    id: serial('id').primaryKey(),
    action: text('action').notNull(),
    email: text('email').notNull(),
    ip: text('ip'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('request_throttle_email_idx').on(table.action, table.email, table.createdAt),
    index('request_throttle_ip_idx').on(table.action, table.ip, table.createdAt),
  ],
)

export type AdminRole = (typeof adminRole.enumValues)[number]
export type SponsorTier = (typeof sponsorTier.enumValues)[number]
export type MemberRole = (typeof memberRole.enumValues)[number]
export type MemberTokenPurpose = (typeof memberTokenPurpose.enumValues)[number]

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
export type Member = typeof members.$inferSelect
export type MemberToken = typeof memberTokens.$inferSelect
export type NewsletterTopic = typeof newsletterTopics.$inferSelect
export type MemberTopicSubscription = typeof memberTopicSubscriptions.$inferSelect
export type RequestThrottle = typeof requestThrottle.$inferSelect

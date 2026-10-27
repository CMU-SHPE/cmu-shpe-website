import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
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
  description: text('description').notNull().default(''),
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
    capacity: integer('capacity'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('events_date_idx').on(table.date),
    check('events_capacity_positive', sql`${table.capacity} > 0`),
  ],
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

export const members = pgTable(
  'members',
  {
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
    sponsorId: integer('sponsor_id').references(() => sponsors.id, { onDelete: 'set null' }),
  },
  (table) => [index('members_sponsor_idx').on(table.sponsorId)],
)

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

// A serial id rather than a composite primary key: drizzle-kit's pushSchema (used for preview
// databases) drops query parameters, and its composite-key introspection is the one query that
// needs them, so every push after such a table exists would fail.
export const memberTopicSubscriptions = pgTable(
  'member_topic_subscriptions',
  {
    id: serial('id').primaryKey(),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => newsletterTopics.id, { onDelete: 'cascade' }),
    optedInAt: timestamp('opted_in_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('member_topic_subscriptions_member_topic_idx').on(table.memberId, table.topicId),
    index('member_topic_subscriptions_topic_idx').on(table.topicId),
  ],
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

// Writes are sent as base64 (4/3 of the file, vs 2x as hex) so a 4 MiB PDF fits the 10 MiB request
// limit of Neon's SQL-over-HTTP proxy; Postgres sends bytea back as `\x` hex text, ~8 MiB at the max.
const bytea = customType<{ data: Uint8Array; driverData: string | Uint8Array }>({
  dataType: () => 'bytea',
  toDriver: (value) => sql`decode(${Buffer.from(value).toString('base64')}, 'base64')`,
  fromDriver: (value) => {
    if (typeof value !== 'string') return Buffer.from(value)
    if (!value.startsWith('\\x')) throw new Error('Expected bytea in hex output format')
    return Buffer.from(value.slice(2), 'hex')
  },
})

export const eventRsvps = pgTable(
  'event_rsvps',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    memberId: integer('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('event_rsvps_event_member_idx').on(table.eventId, table.memberId),
    index('event_rsvps_member_idx').on(table.memberId),
  ],
)

export const sponsorEdits = pgTable(
  'sponsor_edits',
  {
    id: serial('id').primaryKey(),
    sponsorId: integer('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    memberId: integer('member_id').references(() => members.id, { onDelete: 'set null' }),
    memberName: text('member_name').notNull(),
    fields: text('fields').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('sponsor_edits_sponsor_created_idx').on(table.sponsorId, table.createdAt)],
)

// List queries must never select `content`; only the download routes read it.
export const sponsorReceipts = pgTable(
  'sponsor_receipts',
  {
    id: serial('id').primaryKey(),
    sponsorId: integer('sponsor_id')
      .notNull()
      .references(() => sponsors.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    receiptDate: date('receipt_date', { mode: 'string' }).notNull(),
    fileName: text('file_name').notNull(),
    byteSize: integer('byte_size').notNull(),
    content: bytea('content').notNull(),
    uploadedBy: integer('uploaded_by').references(() => admins.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('sponsor_receipts_sponsor_idx').on(table.sponsorId)],
)

export type EventRsvp = typeof eventRsvps.$inferSelect
export type SponsorEdit = typeof sponsorEdits.$inferSelect
export type SponsorReceipt = typeof sponsorReceipts.$inferSelect

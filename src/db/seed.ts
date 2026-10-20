import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
import { type Db, getDb } from './index'
import {
  admins,
  advisors,
  homePillars,
  homeStats,
  nationalStats,
  officers,
  siteContent,
  siteSettings,
  sponsorBenefits,
  sponsors,
} from './schema'
import { contentDefaults } from './seed-data/content'
import { homePillarRows, homeStatRows, nationalStatRows, sponsorBenefitRows } from './seed-data/lists'
import { advisorRows, officerRows } from './seed-data/officers'
import { settingsRow } from './seed-data/settings'
import { sponsorRows } from './seed-data/sponsors'
import { MIN_PASSWORD_LENGTH, parseAdminAccount } from '../lib/admin-account'
import type { OrderedTable } from '../lib/sort-order'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

async function ensureMasterAdmin(db: Db): Promise<string> {
  const [existing] = await db.select({ id: admins.id }).from(admins).limit(1)
  if (existing) return 'admins: an admin already exists, skipped'

  const email = process.env.MASTER_EMAIL
  const password = process.env.MASTER_PASSWORD
  if (!email || !password) {
    throw new Error(
      `No admin account exists yet. Set MASTER_EMAIL and MASTER_PASSWORD (at least ${MIN_PASSWORD_LENGTH} characters) in .env.local, then run npm run db:seed again.`,
    )
  }

  const parsed = parseAdminAccount({ name: 'Master Account', email, password })
  if (!parsed.success) {
    throw new Error(
      parsed.code === 'password'
        ? `MASTER_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters and at most 72 bytes.`
        : 'MASTER_EMAIL is not a valid email address.',
    )
  }

  await db.insert(admins).values({
    name: parsed.data.name,
    email: parsed.data.email,
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    role: 'master',
  })
  return `admins: created master account ${parsed.data.email}`
}

async function seedSettings(db: Db): Promise<string> {
  const [existing] = await db.select({ id: siteSettings.id }).from(siteSettings).limit(1)
  if (existing) return 'site_settings: already set, skipped'

  await db.insert(siteSettings).values(settingsRow)
  return 'site_settings: created'
}

async function seedContent(db: Db): Promise<string> {
  const rows = Object.entries(contentDefaults).map(([key, value]) => ({ key, value }))
  const inserted = await db
    .insert(siteContent)
    .values(rows)
    .onConflictDoNothing({ target: siteContent.key })
    .returning({ key: siteContent.key })
  return `site_content: ${inserted.length} added, ${rows.length - inserted.length} already set`
}

async function seedIfEmpty(
  db: Db,
  label: string,
  table: OrderedTable,
  count: number,
  insert: () => Promise<unknown>,
): Promise<string> {
  const [existing] = await db.select({ id: table.id }).from(table).limit(1)
  if (existing) return `${label}: not empty, skipped`

  await insert()
  return `${label}: ${count} added`
}

async function seed() {
  const db = getDb()

  const summary = [
    await ensureMasterAdmin(db),
    await seedSettings(db),
    await seedContent(db),
    await seedIfEmpty(db, 'officers', officers, officerRows.length, () =>
      db.insert(officers).values(officerRows),
    ),
    await seedIfEmpty(db, 'advisors', advisors, advisorRows.length, () =>
      db.insert(advisors).values(advisorRows),
    ),
    await seedIfEmpty(db, 'sponsors', sponsors, sponsorRows.length, () =>
      db.insert(sponsors).values(sponsorRows),
    ),
    await seedIfEmpty(db, 'home_stats', homeStats, homeStatRows.length, () =>
      db.insert(homeStats).values(homeStatRows),
    ),
    await seedIfEmpty(db, 'home_pillars', homePillars, homePillarRows.length, () =>
      db.insert(homePillars).values(homePillarRows),
    ),
    await seedIfEmpty(db, 'national_stats', nationalStats, nationalStatRows.length, () =>
      db.insert(nationalStats).values(nationalStatRows),
    ),
    await seedIfEmpty(db, 'sponsor_benefits', sponsorBenefits, sponsorBenefitRows.length, () =>
      db.insert(sponsorBenefits).values(sponsorBenefitRows),
    ),
  ]

  console.log(['Seed complete.', ...summary.map((line) => `  ${line}`)].join('\n'))
}

seed().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  },
)

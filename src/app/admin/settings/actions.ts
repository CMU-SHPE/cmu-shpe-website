'use server'

import { redirect } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { siteContent, siteSettings } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { parseSettingsForm } from '@/lib/settings-schema'

export async function saveSettings(formData: FormData) {
  await requireAdmin()

  const parsed = parseSettingsForm(formData)
  if (!parsed.success) redirect('/admin/settings?error=invalid')

  const { subjects, ...settings } = parsed.data
  const subjectsValue = subjects.join('\n')
  const db = getDb()
  const [existing] = await db
    .select({ id: siteSettings.id })
    .from(siteSettings)
    .orderBy(asc(siteSettings.id))
    .limit(1)

  await db.batch([
    existing
      ? db.update(siteSettings).set(settings).where(eq(siteSettings.id, existing.id))
      : db.insert(siteSettings).values(settings),
    db
      .insert(siteContent)
      .values({ key: 'contact.subjects', value: subjectsValue })
      .onConflictDoUpdate({ target: siteContent.key, set: { value: subjectsValue } }),
  ])

  redirect('/admin/settings?saved=1')
}

// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentDefaults } from '@/db/seed-data/content'
import baseline from './sql/policy-text-baseline.json'

/**
 * db:seed never overwrites site_content rows, so production only gets new Privacy Policy and Terms of Use text
 * through a hand-run scripts/sql/<date>-*.sql. Production's text is the baseline (what was live before the first
 * script) with every script's new text applied in date order; content.ts must match it, so a change to the
 * defaults can't merge without the script that puts it live.
 */

const SQL_DIR = path.join(__dirname, 'sql')
const CHANGED = 'content.ts privacy/terms text changed; add a scripts/sql/<date>-*.sql that updates production'

const POLICY_TEXT_ROW = /\(\s*'((?:privacy|terms)\.[a-z.]+)',\s*\$txt\$([\s\S]*?)\$txt\$/g
const SINGLE_UPDATE = /update site_content set value = '((?:[^']|'')*)'\s+where key = '((?:privacy|terms)\.[a-z.]+)'/g

function newTextIn(script: string): Map<string, string> {
  const text = new Map<string, string>()
  for (const [, key, value] of script.matchAll(POLICY_TEXT_ROW)) text.set(key, value)
  for (const [, value, key] of script.matchAll(SINGLE_UPDATE)) text.set(key, value.replaceAll("''", "'"))
  return text
}

const scripts = readdirSync(SQL_DIR)
  .filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.sql$/.test(name))
  .sort()
  .map((name) => ({ name, newText: newTextIn(readFileSync(path.join(SQL_DIR, name), 'utf8')) }))

function productionText() {
  const text = new Map<string, { value: string; from: string }>(
    Object.entries(baseline as Record<string, string>).map(([key, value]) => [key, { value, from: 'policy-text-baseline.json' }]),
  )
  for (const { name, newText } of scripts) {
    for (const [key, value] of newText) text.set(key, { value, from: name })
  }
  return text
}

const policyDefaults = Object.entries(contentDefaults).filter(([key]) => /^(privacy|terms)\./.test(key))

describe('Privacy Policy and Terms of Use text in production', () => {
  it('reads new text from every policy script', () => {
    expect(scripts.length).toBeGreaterThan(0)
    for (const { name, newText } of scripts) {
      expect(newText.size, `${name}: no privacy/terms text found; use the policy_text $txt$ rows of the latest script`).toBeGreaterThan(0)
    }
  })

  it('matches the content.ts defaults key for key', () => {
    const production = productionText()
    for (const [key, value] of policyDefaults) {
      const live = production.get(key)
      expect(live, `${key} is new: add it to scripts/sql/policy-text-baseline.json, or to a script if production needs it`).toBeDefined()
      expect(value, `${CHANGED} (${key} differs from ${live!.from})`).toBe(live!.value)
    }
  })
})

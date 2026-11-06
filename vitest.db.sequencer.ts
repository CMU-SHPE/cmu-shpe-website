import path from 'path'
import { BaseSequencer, type TestSpecification } from 'vitest/node'

// Seconds per file from CI run 42287627456; a file not listed here counts as DEFAULT_SECONDS.
const SECONDS: Record<string, number> = {
  'src/app/authz-matrix.db.test.ts': 237,
  'src/lib/newsletter-db.pg.test.ts': 234,
  'src/app/throttles.db.test.ts': 169,
  'src/app/join/actions.db.test.ts': 64,
  'src/app/account-recovery.db.test.ts': 64,
  'src/app/sponsor/actions.db.test.ts': 54,
  'src/app/admin/newsletters/pages.pg.test.tsx': 49,
  'src/app/account-email-collision.db.test.ts': 38,
  'src/lib/rsvp.db.test.ts': 37,
  'src/app/admin/sponsors/actions.db.test.ts': 29,
  'src/app/admin/gallery/actions.db.test.ts': 26,
  'src/lib/receipts.db.test.ts': 23,
  'src/db/harness.db.test.ts': 23,
  'src/app/admin/lists/actions.db.test.ts': 19,
  'src/app/admin/events/actions.db.test.ts': 17,
  'src/app/admin/sponsors/[id]/receipts/receipts.db.test.ts': 16,
  'src/app/admin/officers/actions.crud.db.test.ts': 15,
  'src/app/admin/officers/actions.db.test.ts': 15,
  'src/lib/sponsor-portal.db.test.ts': 11,
  'src/app/sponsor/receipts/[id]/route.db.test.ts': 10,
  'src/app/member-deletion.db.test.ts': 10,
  'src/lib/event-writes.db.test.ts': 10,
  'src/app/admin/members/actions.db.test.ts': 10,
  'src/app/admin/events/[id]/attendees.csv/route.db.test.ts': 7,
  'src/app/events/actions.db.test.ts': 7,
  'src/lib/sponsor-portal-admin.db.test.ts': 5,
  'src/lib/image-references.db.test.ts': 4,
  'src/app/edit-actions.db.test.ts': 4,
  'src/app/contact/actions.db.test.ts': 2,
}
const DEFAULT_SECONDS = 15

/** Packs files into shards by their known run time, so one shard isn't left holding the slowest files. */
export default class DbShardSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const { root, shard } = this.ctx.config
    const { index, count } = shard!
    const weighted = files
      .map((spec) => {
        const file = path.relative(root, spec.moduleId).split(path.sep).join('/')
        return { spec, file, seconds: SECONDS[file] ?? DEFAULT_SECONDS }
      })
      .sort((a, b) => b.seconds - a.seconds || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))

    const totals = Array<number>(count).fill(0)
    const mine: TestSpecification[] = []
    for (const { spec, seconds } of weighted) {
      const lightest = totals.indexOf(Math.min(...totals))
      totals[lightest] += seconds
      if (lightest === index - 1) mine.push(spec)
    }
    return mine
  }
}

import SubmitButton from '@/components/submit-button'
import DeleteButton from '@/components/admin/delete-button'
import MoveButtons from '@/components/admin/move-buttons'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import type { HomePillar, HomeStat, NationalStat, SponsorBenefit } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { BENEFIT_COLUMNS, MAX_BENEFIT_TEXT_LENGTH, parseBenefitCell } from '@/lib/benefit-cells'
import { type ListName, MAX_LIST_DESCRIPTION_LENGTH } from '@/lib/list-schemas'
import { getHomePillars, getHomeStats, getNationalStats, getSponsorBenefits } from '@/lib/queries'
import { SPONSOR_TIERS, type Tier } from '@/lib/sponsor-tiers'
import {
  createHomePillar,
  createHomeStat,
  createNationalStat,
  createSponsorBenefit,
  deleteListItem,
  moveListItem,
  updateHomePillar,
  updateHomeStat,
  updateNationalStat,
  updateSponsorBenefit,
} from './actions'

const errorMessages: Record<string, string> = {
  invalid: `Please check the fields — every field except descriptions is required, and short benefit text can be at most ${MAX_BENEFIT_TEXT_LENGTH} characters.`,
  missing: 'That item no longer exists.',
}

function ListEditor<T extends { id: number }>({
  list,
  title,
  description,
  items,
  itemName,
  Fields,
  update,
  create,
  addLabel,
}: {
  list: ListName
  title: string
  description: string
  items: T[]
  itemName: (item: T) => string
  Fields: (props: { item?: T }) => React.ReactNode
  update: (id: number, formData: FormData) => Promise<void>
  create: (formData: FormData) => Promise<void>
  addLabel: string
}) {
  const headingId = `${list}-heading`

  return (
    <section className={cardClass} aria-labelledby={headingId}>
      <h2 id={headingId} className={sectionHeadingClass}>
        {title}
      </h2>
      <p className={`mt-1 ${mutedTextClass}`}>{description}</p>

      {items.length === 0 ? (
        <p className={`mt-4 ${mutedTextClass}`}>Nothing here yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => {
            const name = itemName(item)
            return (
              <li key={item.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <form action={update.bind(null, item.id)} className="space-y-3">
                  <Fields item={item} />
                  <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
                    Save<span className="sr-only"> {name}</span>
                  </SubmitButton>
                </form>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                  <MoveButtons
                    name={name}
                    moveUp={index > 0 ? moveListItem.bind(null, list, item.id, 'up') : undefined}
                    moveDown={
                      index < items.length - 1 ? moveListItem.bind(null, list, item.id, 'down') : undefined
                    }
                  />
                  <form action={deleteListItem.bind(null, list, item.id)}>
                    <DeleteButton name={name} />
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form action={create} className="mt-6 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{addLabel}</h3>
        <Fields />
        <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
          {addLabel}
        </SubmitButton>
      </form>
    </section>
  )
}

function HomeStatFields({ item }: { item?: HomeStat }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
      <label className={labelClass}>
        Value
        <input name="value" required maxLength={50} defaultValue={item?.value} placeholder="25+" className={inputClass} />
      </label>
      <label className={labelClass}>
        Label
        <input name="label" required maxLength={100} defaultValue={item?.label} className={inputClass} />
      </label>
    </div>
  )
}

function HomePillarFields({ item }: { item?: HomePillar }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
      <label className={labelClass}>
        Icon (emoji)
        <input name="icon" required maxLength={16} defaultValue={item?.icon} className={inputClass} />
      </label>
      <label className={labelClass}>
        Title
        <input name="title" required maxLength={100} defaultValue={item?.title} className={inputClass} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Description
        <textarea
          name="description"
          rows={2}
          maxLength={MAX_LIST_DESCRIPTION_LENGTH}
          defaultValue={item?.description}
          className={inputClass}
        />
      </label>
    </div>
  )
}

function NationalStatFields({ item }: { item?: NationalStat }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
      <label className={labelClass}>
        Value
        <input name="value" required maxLength={50} defaultValue={item?.value} className={inputClass} />
      </label>
      <label className={labelClass}>
        Label
        <input name="label" required maxLength={100} defaultValue={item?.label} className={inputClass} />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Description
        <textarea
          name="description"
          rows={2}
          maxLength={MAX_LIST_DESCRIPTION_LENGTH}
          defaultValue={item?.description}
          className={inputClass}
        />
      </label>
    </div>
  )
}

function BenefitCellField({ tier, value }: { tier: Tier; value?: string }) {
  const column = BENEFIT_COLUMNS[tier]
  const cell = parseBenefitCell(value ?? 'yes')
  return (
    <fieldset className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">{tier}</legend>
      <label className={labelClass}>
        Shows
        <select
          name={`${column}Mode`}
          defaultValue={cell.kind === 'text' ? 'custom' : cell.kind}
          className={inputClass}
        >
          <option value="yes">Included (check)</option>
          <option value="no">Not included (X)</option>
          <option value="custom">Short text</option>
        </select>
      </label>
      <label className={labelClass}>
        Short text, e.g. 1
        <input
          name={`${column}Text`}
          maxLength={MAX_BENEFIT_TEXT_LENGTH}
          defaultValue={cell.kind === 'text' ? cell.text : ''}
          className={inputClass}
        />
      </label>
    </fieldset>
  )
}

function SponsorBenefitFields({ item }: { item?: SponsorBenefit }) {
  return (
    <div className="space-y-3">
      <label className={labelClass}>
        Benefit
        <input name="label" required maxLength={200} defaultValue={item?.label} className={inputClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SPONSOR_TIERS.map((tier) => (
          <BenefitCellField key={tier} tier={tier} value={item?.[BENEFIT_COLUMNS[tier]]} />
        ))}
      </div>
    </div>
  )
}

export default async function AdminListsPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, stats, pillars, nationalStats, benefits] = await Promise.all([
    props.searchParams,
    getHomeStats(),
    getHomePillars(),
    getNationalStats(),
    getSponsorBenefits(),
  ])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Page lists</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <ListEditor
        list="homeStats"
        title="Home page stats"
        description="The numbers in the red band under the home page title."
        items={stats}
        itemName={(stat) => `${stat.value} ${stat.label}`}
        Fields={HomeStatFields}
        update={updateHomeStat}
        create={createHomeStat}
        addLabel="Add stat"
      />

      <ListEditor
        list="homePillars"
        title="Home page pillars"
        description="The cards next to the mission on the home page."
        items={pillars}
        itemName={(pillar) => pillar.title}
        Fields={HomePillarFields}
        update={updateHomePillar}
        create={createHomePillar}
        addLabel="Add pillar"
      />

      <ListEditor
        list="nationalStats"
        title="SHPE National stats"
        description="The cards in the About SHPE National section of the About page."
        items={nationalStats}
        itemName={(stat) => stat.label}
        Fields={NationalStatFields}
        update={updateNationalStat}
        create={createNationalStat}
        addLabel="Add national stat"
      />

      <ListEditor
        list="sponsorBenefits"
        title="Sponsor benefits table"
        description="The rows of the tier comparison table on the Sponsors page."
        items={benefits}
        itemName={(benefit) => benefit.label}
        Fields={SponsorBenefitFields}
        update={updateSponsorBenefit}
        create={createSponsorBenefit}
        addLabel="Add benefit"
      />
    </div>
  )
}

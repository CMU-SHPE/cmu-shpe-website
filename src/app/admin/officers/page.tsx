import SubmitButton from '@/components/submit-button'
import MoveButtons from '@/components/admin/move-buttons'
import PersonFields from '@/components/admin/person-fields'
import EditDetails from '@/components/admin/edit-details'
import StatusBanner from '@/components/admin/status-banner'
import {
  cardClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  mutedTextClass,
  pageHeadingClass,
  primaryButtonClass,
  sectionHeadingClass,
} from '@/components/admin/styles'
import type { Advisor, Officer } from '@/db/schema'
import { requireAdmin } from '@/lib/admin'
import { getAdvisors, getOfficers } from '@/lib/queries'
import {
  createAdvisor,
  createOfficer,
  deleteAdvisor,
  deleteOfficer,
  moveAdvisor,
  moveOfficer,
  updateAdvisor,
  updateOfficer,
} from './actions'

const errorMessages: Record<string, string> = {
  invalid:
    'Please check the fields — name, role and the other required fields must be filled in, the email must be valid, LinkedIn must start with http:// or https://, and a photo path must start with / or http(s)://.',
  upload: 'The upload failed — use an image file (JPEG, PNG, WebP, GIF, AVIF or SVG) under 8 MB.',
  missing: 'That person no longer exists.',
  storage: "The image couldn't be saved right now — please try again in a minute. Nothing was changed.",
}

function OfficerFields({ officer }: { officer?: Officer }) {
  return (
    <>
      <label className={labelClass}>
        Major
        <input name="major" required maxLength={200} defaultValue={officer?.major} className={inputClass} />
      </label>
      <label className={labelClass}>
        Year
        <input
          name="year"
          required
          maxLength={100}
          defaultValue={officer?.year}
          placeholder="Junior"
          className={inputClass}
        />
      </label>
    </>
  )
}

function AdvisorFields({ advisor }: { advisor?: Advisor }) {
  return (
    <label className={labelClass}>
      Department
      <input
        name="department"
        required
        maxLength={200}
        defaultValue={advisor?.department}
        className={inputClass}
      />
    </label>
  )
}

function PersonItem({
  person,
  moveUp,
  moveDown,
  remove,
  update,
  children,
}: {
  person: Officer | Advisor
  moveUp?: () => Promise<void>
  moveDown?: () => Promise<void>
  remove: () => Promise<void>
  update: (formData: FormData) => Promise<void>
  children: React.ReactNode
}) {
  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap items-center gap-4">
        {person.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photoUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-white">{person.name}</p>
          <p className={mutedTextClass}>{person.role}</p>
        </div>
        <MoveButtons name={person.name} moveUp={moveUp} moveDown={moveDown} />
        <form action={remove}>
          <SubmitButton pendingLabel="Deleting…" className={dangerButtonClass}>
            Delete<span className="sr-only"> {person.name}</span>
          </SubmitButton>
        </form>
      </div>
      <EditDetails name={person.name}>
        <form action={update} className="mt-4 max-w-md space-y-4">
          <PersonFields person={person}>{children}</PersonFields>
          <SubmitButton pendingLabel="Saving…" className={primaryButtonClass}>
            Save changes
          </SubmitButton>
        </form>
      </EditDetails>
    </li>
  )
}

export default async function AdminOfficersPage(props: {
  searchParams: Promise<{ saved?: string; error?: string }>
}) {
  await requireAdmin()
  const [{ saved, error }, officerRows, advisorRows] = await Promise.all([
    props.searchParams,
    getOfficers(),
    getAdvisors(),
  ])

  return (
    <div className="space-y-6">
      <h1 className={pageHeadingClass}>Officers and faculty advisor</h1>

      <StatusBanner saved={saved} error={error} errorMessages={errorMessages} />

      <section className={cardClass} aria-labelledby="add-officer-heading">
        <h2 id="add-officer-heading" className={sectionHeadingClass}>
          Add officer
        </h2>
        <form action={createOfficer} className="mt-4 max-w-md space-y-4">
          <PersonFields>
            <OfficerFields />
          </PersonFields>
          <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
            Add officer
          </SubmitButton>
        </form>
      </section>

      <section className={cardClass} aria-labelledby="officers-heading">
        <h2 id="officers-heading" className={sectionHeadingClass}>
          Executive board
        </h2>
        <p className={`mt-1 ${mutedTextClass}`}>Shown on the Officers page in this order.</p>
        {officerRows.length === 0 ? (
          <p className={`mt-4 ${mutedTextClass}`}>No officers yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {officerRows.map((officer, index) => (
              <PersonItem
                key={officer.id}
                person={officer}
                moveUp={index > 0 ? moveOfficer.bind(null, officer.id, 'up') : undefined}
                moveDown={
                  index < officerRows.length - 1 ? moveOfficer.bind(null, officer.id, 'down') : undefined
                }
                remove={deleteOfficer.bind(null, officer.id)}
                update={updateOfficer.bind(null, officer.id)}
              >
                <OfficerFields officer={officer} />
              </PersonItem>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass} aria-labelledby="add-advisor-heading">
        <h2 id="add-advisor-heading" className={sectionHeadingClass}>
          Add faculty advisor
        </h2>
        <form action={createAdvisor} className="mt-4 max-w-md space-y-4">
          <PersonFields>
            <AdvisorFields />
          </PersonFields>
          <SubmitButton pendingLabel="Adding…" className={primaryButtonClass}>
            Add faculty advisor
          </SubmitButton>
        </form>
      </section>

      <section className={cardClass} aria-labelledby="advisors-heading">
        <h2 id="advisors-heading" className={sectionHeadingClass}>
          Faculty advisors
        </h2>
        {advisorRows.length === 0 ? (
          <p className={`mt-4 ${mutedTextClass}`}>No faculty advisor yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {advisorRows.map((advisor, index) => (
              <PersonItem
                key={advisor.id}
                person={advisor}
                moveUp={index > 0 ? moveAdvisor.bind(null, advisor.id, 'up') : undefined}
                moveDown={
                  index < advisorRows.length - 1 ? moveAdvisor.bind(null, advisor.id, 'down') : undefined
                }
                remove={deleteAdvisor.bind(null, advisor.id)}
                update={updateAdvisor.bind(null, advisor.id)}
              >
                <AdvisorFields advisor={advisor} />
              </PersonItem>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

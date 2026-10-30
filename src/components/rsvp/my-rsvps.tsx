import { cardClass, sectionHeadingClass } from '@/components/admin/styles'
import { eventSchedule } from '@/lib/event-dates'
import { listMyRsvps } from '@/lib/rsvp'
import MyRsvpList from './my-rsvp-list'

const HEADING_ID = 'my-rsvps-heading'

export default async function MyRsvps({ memberId }: { memberId: number }) {
  const rsvps = await listMyRsvps(memberId)

  return (
    <section className={cardClass} aria-labelledby={HEADING_ID}>
      <h2 id={HEADING_ID} tabIndex={-1} className={`${sectionHeadingClass} focus:outline-none`}>
        My RSVPs
      </h2>
      <MyRsvpList
        headingId={HEADING_ID}
        rsvps={rsvps.map((rsvp) => {
          const { dates, times } = eventSchedule(rsvp)
          const oneLine = times.length <= 1
          return {
            eventId: rsvp.eventId,
            title: rsvp.title,
            when: oneLine ? [dates, ...times].join(' · ') : dates,
            times: oneLine ? [] : times,
            location: rsvp.location,
          }
        })}
      />
    </section>
  )
}

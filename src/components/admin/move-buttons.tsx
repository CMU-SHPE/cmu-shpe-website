import SubmitButton from '@/components/submit-button'
import { secondaryButtonClass } from '@/components/admin/styles'

const slotClass = 'inline-block w-11'

export default function MoveButtons({
  name,
  moveUp,
  moveDown,
}: {
  name: string
  moveUp?: () => Promise<void>
  moveDown?: () => Promise<void>
}) {
  return (
    <div className="flex gap-1">
      {moveUp ? (
        <form action={moveUp}>
          <SubmitButton className={secondaryButtonClass} title={`Move ${name} up`}>
            <span aria-hidden="true">↑</span>
            <span className="sr-only">Move {name} up</span>
          </SubmitButton>
        </form>
      ) : (
        <span aria-hidden="true" className={slotClass} />
      )}
      {moveDown ? (
        <form action={moveDown}>
          <SubmitButton className={secondaryButtonClass} title={`Move ${name} down`}>
            <span aria-hidden="true">↓</span>
            <span className="sr-only">Move {name} down</span>
          </SubmitButton>
        </form>
      ) : (
        <span aria-hidden="true" className={slotClass} />
      )}
    </div>
  )
}

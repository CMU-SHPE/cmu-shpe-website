'use client'

import { useFormStatus } from 'react-dom'

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function SubmitButton({
  children,
  pendingLabel,
  className = '',
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      {...props}
      type="submit"
      aria-disabled={pending || props['aria-disabled']}
      aria-busy={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      className={`${className} inline-flex items-center justify-center gap-2 transition active:scale-[0.97] disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
    >
      {pending && <Spinner />}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  )
}

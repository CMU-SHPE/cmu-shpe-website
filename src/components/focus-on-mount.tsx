'use client'

import { useEffect, useRef } from 'react'

// After a form posts and the page reloads with a result, focus starts at the top of the
// document; moving it to the result tells keyboard and screen reader users what happened.
export default function FocusOnMount({ id, children }: { id: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  return (
    <div id={id} ref={ref} tabIndex={-1} className="focus:outline-none">
      {children}
    </div>
  )
}

'use client'

import { useState } from 'react'

export default function OfficerAvatar({
  name,
  photo,
  size = 'md',
}: {
  name: string
  photo?: string
  size?: 'md' | 'lg'
}) {
  const [imgError, setImgError] = useState(false)

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)

  const sizeClasses = size === 'lg' ? 'w-20 h-20' : 'w-24 h-24'
  const textClass = size === 'lg' ? 'text-xl' : 'text-2xl'

  if (photo && !imgError) {
    return (
      <div className={`${sizeClasses} rounded-full overflow-hidden mx-auto mb-4 flex-shrink-0`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo}
          alt={name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-shpe-red to-cmu-maroon flex items-center justify-center mx-auto mb-4`}
    >
      <span className={`text-white font-bold ${textClass}`}>{initials}</span>
    </div>
  )
}

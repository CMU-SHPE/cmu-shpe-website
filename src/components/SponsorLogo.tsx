'use client'

import { useState } from 'react'

type Tier = 'Platinum' | 'Gold' | 'Silver' | 'Bronze'

const tierSizes: Record<Tier, string> = {
  Platinum: 'w-48 h-24',
  Gold: 'w-40 h-20',
  Silver: 'w-32 h-16',
  Bronze: 'w-28 h-14',
}

export default function SponsorLogo({
  name,
  logo,
  tier,
  website,
  bgColor = 'bg-white',
  size: sizeProp,
}: {
  name: string
  logo?: string
  tier: Tier
  website?: string
  bgColor?: string
  size?: string
}) {
  const [imgError, setImgError] = useState(false)
  const size = sizeProp ?? tierSizes[tier]
  const showLogo = logo && !imgError

  const placeholder = (
    <div
      className={`${size} flex items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 text-xs font-medium text-center px-3 leading-tight`}
    >
      {name}
    </div>
  )

  if (!showLogo) return placeholder

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
  const logoEl = (
    <div
      className={`${size} rounded-xl border border-gray-200 ${bgColor} overflow-hidden flex items-center justify-center`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${base}${logo}`}
        alt={`${name} logo`}
        onError={() => setImgError(true)}
        className="w-full h-full object-contain p-3"
      />
    </div>
  )

  if (website) {
    return (
      <a
        href={website}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl hover:opacity-80 hover:shadow-md transition-all duration-200"
      >
        {logoEl}
      </a>
    )
  }

  return logoEl
}

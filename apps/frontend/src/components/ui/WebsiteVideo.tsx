'use client'
import Image from 'next/image'
import { useState } from 'react'
export function WebsiteVideo({
  id,
  title,
  label,
  short = false
}: {
  id: string
  title: string
  label: string
  short?: boolean
}) {
  const [playing, setPlaying] = useState(false)
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-black mx-auto ${short ? 'aspect-[9/16] max-w-sm' : 'aspect-video w-full'}`}
    >
      {playing ? (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          onClick={() => setPlaying(true)}
          className="absolute inset-0 w-full h-full flex items-center justify-center"
          aria-label={`${label}: ${title}`}
        >
          <Image
            unoptimized
            width={480}
            height={360}
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          />
          <span className="relative bg-black/80 text-white px-6 py-3 rounded-full">
            ▶ {label}
          </span>
        </button>
      )}
    </div>
  )
}

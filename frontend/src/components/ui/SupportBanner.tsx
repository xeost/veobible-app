'use client'

import React, { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n/client'
import { Tooltip } from '@/components/ui/Tooltip'

const YOUTUBE_CHANNELS = [
  { lang: 'es', url: 'https://www.youtube.com/@veobible-es', label: 'VeoBible Español' },
  { lang: 'en', url: 'https://www.youtube.com/@veobible', label: 'VeoBible English' },
]

const DONATION_PLATFORMS: { id: string; name: string; url: string }[] = [
  // { id: 'paypal', name: 'PayPal', url: 'https://paypal.me/veobible' },
  // { id: 'kofi', name: 'Ko-fi', url: 'https://ko-fi.com/veobible' },
  // { id: 'patreon', name: 'Patreon', url: 'https://patreon.com/veobible' },
]

interface SupportBannerProps {
  isClosable?: boolean
}

export function SupportBanner({ isClosable = false }: SupportBannerProps) {
  const { locale } = useI18n()
  const [closed, setClosed] = useState(false)
  const [showSecondStep, setShowSecondStep] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showDonations, setShowDonations] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isClosable) {
      const isClosed = localStorage.getItem('veobible_support_banner_closed') === 'true'
      setClosed(isClosed)
    }
  }, [isClosable])

  if (!mounted) return null
  if (isClosable && closed && !showSecondStep) return null

  const isEs = locale === 'es'
  const costsList = isEs ? (
    <div className="flex flex-col gap-2.5 text-left text-sm py-1">
      <strong className="block mb-1.5 text-base" style={{ color: 'var(--text-primary)' }}>¿Cuáles son los costos?</strong>
      <ul className="list-disc pl-5 space-y-2 opacity-90">
        <li>Restauración y generación de audios para la audio Biblia</li>
        <li>Alojamiento web en Cloudflare, sincronización de datos de usuario y base de datos</li>
        <li>Servicio de autenticación de usuario con Supabase</li>
        <li>Créditos de IA para generación de código</li>
        <li>Apoyo económico al programador principal</li>
      </ul>
    </div>
  ) : (
    <div className="flex flex-col gap-2.5 text-left text-sm py-1">
      <strong className="block mb-1.5 text-base" style={{ color: 'var(--text-primary)' }}>What are the costs?</strong>
      <ul className="list-disc pl-5 space-y-2 opacity-90">
        <li>Restoration and audio generation for the audio Bible</li>
        <li>Web hosting on Cloudflare, user data synchronization, and database</li>
        <li>User authentication service with Supabase</li>
        <li>AI credits for assisted code generation</li>
        <li>Financial support for the main programmer</li>
      </ul>
    </div>
  )

  const text = {
    title: isEs ? "Ayuda a VeoBible sin gastar un centavo" : "Support VeoBible without spending a dime",
    mainMsg: isEs
      ? (
        <>
          Suscribirte a nuestro canal de YouTube es gratis y nos ayuda a cubrir los{' '}
          <Tooltip content={costsList} placement="top" wrapContent className="inline-flex">
            <span className="underline decoration-dashed underline-offset-4 cursor-help transition-colors hover:opacity-80" style={{ color: 'var(--text-primary)', textDecorationColor: 'color-mix(in srgb, var(--text-muted) 40%, transparent)' }}>
              costos
            </span>
          </Tooltip>
          {' '}para mantener esta app sin publicidad.
        </>
      )
      : (
        <>
          Subscribing to our YouTube channel is free and is the best way to help us cover{' '}
          <Tooltip content={costsList} placement="top" wrapContent className="inline-flex">
            <span className="underline decoration-dashed underline-offset-4 cursor-help transition-colors hover:opacity-80" style={{ color: 'var(--text-primary)', textDecorationColor: 'color-mix(in srgb, var(--text-muted) 40%, transparent)' }}>
              costs
            </span>
          </Tooltip>
          {' '}to keep this app ad-free.
        </>
      ),
    footerMsg: isEs
      ? "Si deseas apoyarnos económicamente, puedes hacer una donación a través de:"
      : "If you wish to support us financially, you can make a donation via:",
    secondStepMsg: isEs
      ? "Este mensaje no volverá a aparecer aquí, pero siempre podrás encontrarlo al final de la página si deseas apoyar a VeoBible. ¡Gracias!"
      : "This message will no longer appear here, but you can always find it at the bottom of the page if you wish to support VeoBible. Thank you!",
    closeBtn: isEs ? "Cerrar" : "Close",
    closeTooltip: isEs ? "Ocultar permanentemente" : "Hide permanently",
    cancelBtn: isEs ? "Cancelar" : "Cancel",
    understoodBtn: isEs ? "Entendido" : "Understood",
    subscribeBtn: isEs ? "Suscribirse al canal" : "Subscribe to channel",
    orDonateBtn: isEs ? "También puedes donar" : "You can also donate",
  }

  const handleClose = () => {
    setShowSecondStep(true)
  }

  const handleFinalClose = () => {
    localStorage.setItem('veobible_support_banner_closed', 'true')
    setClosed(true)
    setShowSecondStep(false)
  }

  const handleCancelClose = () => {
    setShowSecondStep(false)
  }

  const YoutubeIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )

  const XIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )

  const HeartIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )

  if (showSecondStep) {
    return (
      <div className="mx-auto my-12 p-6 rounded-3xl border flex flex-col items-center text-center w-full transition-all duration-500 animate-fade-in"
        style={{
          maxWidth: '42rem',
          borderColor: 'var(--border)',
          background: 'color-mix(in srgb, var(--bg-card) 60%, transparent)',
          backdropFilter: 'blur(12px)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="w-14 h-14 rounded-full mb-4 flex items-center justify-center bg-gradient-to-br from-rose-500/20 to-red-500/20 text-rose-500">
          <HeartIcon />
        </div>
        <p className="text-base leading-relaxed mb-6 font-medium max-w-sm" style={{ color: 'var(--text-primary)' }}>
          {text.secondStepMsg}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancelClose}
            className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            {text.cancelBtn}
          </button>
          <button
            onClick={handleFinalClose}
            className="px-8 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-105 shadow-md hover:shadow-lg"
            style={{ background: 'var(--brand)', color: '#fff' }}
          >
            {text.understoodBtn}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto my-12 relative rounded-3xl overflow-hidden transition-all duration-300 group w-full"
      style={{
        maxWidth: '42rem',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        background: 'var(--bg-card)',
      }}
    >
      {/* Background gradients and glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at top, color-mix(in srgb, var(--brand) 12%, transparent) 0%, transparent 70%)',
      }} />
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full pointer-events-none blur-3xl opacity-20 bg-red-500" />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full pointer-events-none blur-3xl opacity-20 bg-brand" />

      {isClosable && (
        <div className="absolute top-4 right-4 z-20">
          <Tooltip content={text.closeTooltip} placement="top">
            <button
              onClick={handleClose}
              className="p-2.5 rounded-full transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/10 hover:scale-110 cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
              aria-label={text.closeBtn}
            >
              <XIcon />
            </button>
          </Tooltip>
        </div>
      )}

      <div className="relative z-10 p-8 md:p-10 flex flex-col items-center text-center">
        {/* Main Icon */}
        <div className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500"
          style={{
            background: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(255,0,0,0.35)'
          }}
        >
          <YoutubeIcon />
        </div>

        {/* Title */}
        <h3 className="text-2xl md:text-3xl font-bold mb-4 tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-lora), Georgia, serif' }}>
          {text.title}
        </h3>

        {/* Description */}
        <p className="text-base md:text-lg leading-relaxed mb-8 max-w-xl mx-auto font-medium opacity-90" style={{ color: 'var(--text-secondary)' }}>
          {text.mainMsg}
        </p>

        {/* YouTube Button */}
        <div className={`flex flex-col sm:flex-row gap-3 w-full justify-center items-center ${DONATION_PLATFORMS.length > 0 && showDonations ? 'mb-10' : (DONATION_PLATFORMS.length > 0 && !showDonations ? 'mb-6' : '')}`}>
          {(() => {
            const channel = YOUTUBE_CHANNELS.find(c => c.lang === locale) || YOUTUBE_CHANNELS[0];
            return (
              <a
                href={channel.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300 shadow-sm hover:shadow-xl transform hover:-translate-y-1 w-full sm:w-auto"
                style={{
                  background: 'linear-gradient(135deg, #FF0000 0%, #CC0000 100%)',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                <YoutubeIcon />
                {text.subscribeBtn}
              </a>
            );
          })()}
        </div>

        {/* Or Donate Button */}
        {!showDonations && DONATION_PLATFORMS.length > 0 && (
          <button
            onClick={() => setShowDonations(true)}
            className="text-sm font-medium underline decoration-dashed underline-offset-4 cursor-pointer transition-all duration-300 hover:opacity-80 transform hover:-translate-y-0.5 active:scale-95"
            style={{ color: 'var(--text-muted)', textDecorationColor: 'color-mix(in srgb, var(--text-muted) 40%, transparent)' }}
          >
            {text.orDonateBtn}
          </button>
        )}

        {/* Footer (Donations) */}
        {showDonations && DONATION_PLATFORMS.length > 0 && (
          <div className="w-full pt-6 relative">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent" />
            <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-muted)' }}>
              {text.footerMsg}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {DONATION_PLATFORMS.map(platform => (
                <a
                  key={platform.id}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold px-4 py-2 rounded-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    background: 'color-mix(in srgb, var(--brand) 8%, transparent)',
                    color: 'var(--brand)',
                    border: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)'
                  }}
                >
                  {platform.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

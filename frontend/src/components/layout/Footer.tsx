import React from 'react'
import Link from 'next/link'

interface FooterProps {
  lang: string
}

export function Footer({ lang }: FooterProps) {
  const isEs = lang === 'es'
  const isPt = lang === 'pt'

  const readingLinks = [
    { href: `/en/kjv`, label: 'King James Version (KJV)' },
    { href: `/es/rv1909`, label: 'Reina Valera 1909 (RV1909)' },
    { href: `/pt/arc`, label: 'Almeida Revista e Corrigida (ARC)' },
  ]

  return (
    <footer
      className="w-full border-t py-12 px-6 mt-auto transition-colors duration-200"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Brand Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span
              className="font-bold text-xl tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-lora), Georgia, serif' }}
            >
              VeoBible
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {isPt
              ? 'Uma experiência moderna e focada para ler e estudar as Escrituras Sagradas.'
              : isEs
              ? 'Una experiencia moderna y enfocada para leer y estudiar las Sagradas Escrituras.'
              : 'A modern, focused experience for reading and studying the Holy Scriptures.'}
          </p>
          <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
            &copy; {new Date().getFullYear()} VeoBible. {isPt ? 'Todos os direitos reservados.' : isEs ? 'Todos los derechos reservados.' : 'All rights reserved.'}
          </p>
        </div>

        {/* Read Column */}
        <div className="space-y-4">
          <h3
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--brand)' }}
          >
            {isPt ? 'Leitura' : isEs ? 'Lectura' : 'Read'}
          </h3>
          <ul className="space-y-2">
            {readingLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm transition-colors hover:opacity-85"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}

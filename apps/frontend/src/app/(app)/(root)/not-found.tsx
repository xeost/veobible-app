import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-4"
      style={{ background: 'var(--bg-page)' }}
    >
      <div
        className="text-7xl font-bold mb-4"
        style={{ color: 'var(--brand)', fontFamily: 'var(--font-lora), Georgia, serif' }}
      >
        404
      </div>
      <p className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Page not found
      </p>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        The passage you are looking for does not exist.
      </p>
      <Link href="/" className="btn-brand">
        Go Home
      </Link>
    </div>
  )
}

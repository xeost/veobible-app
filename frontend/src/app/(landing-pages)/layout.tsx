import type { Metadata } from 'next'
import { Outfit, Inter } from 'next/font/google'
import '@/styles/spa.css'

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'VeoBible',
}

export default function SpaLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={`${outfit.variable} ${inter.variable}`}>
      <body className="min-h-screen flex flex-col antialiased bg-[#FAF9F5] text-slate-900 font-sans">
        {children}
      </body>
    </html>
  )
}

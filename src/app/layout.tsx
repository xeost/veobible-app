import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { ToastContainer } from '@/components/ui/Toast'
import '@/styles/globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://veobible.app'),
  title: {
    default: 'VeoBible — Read the Bible',
    template: '%s | VeoBible',
  },
  description:
    'A modern Bible reading app with multiple versions in English and Spanish. Read, bookmark, and study the Bible.',
  applicationName: 'VeoBible',
  authors: [{ name: 'VeoBible' }],
  keywords: ['Bible', 'KJV', 'Reina Valera', 'Bible reader', 'Scripture'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VeoBible',
  },
  openGraph: {
    type: 'website',
    siteName: 'VeoBible',
    title: 'VeoBible — Read the Bible',
    description: 'A modern Bible reading app with multiple versions.',
  },
  twitter: {
    card: 'summary',
    title: 'VeoBible',
    description: 'A modern Bible reading app with multiple versions.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0e17' },
  ],
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${lora.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  )
}

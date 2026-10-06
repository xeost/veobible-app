import type { Metadata, Viewport } from 'next'
import { Inter, Lora } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from 'next-themes'
import { ToastContainer } from '@/components/ui/Toast'
import { ReaderPreferencesProvider } from '@/hooks/useReaderPreferences'
import { ThemeColorUpdater } from '@/components/layout/ThemeColorUpdater'
import { PwaUpdateBanner } from '@/components/layout/PwaUpdateBanner'
import { QueryProvider } from '@/lib/query/QueryProvider'
import { AuthProvider } from '@/lib/auth/AuthContext'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const lora = Lora({ subsets: ['latin'], variable: '--font-lora', display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://veobible.app'),
  title: {
    default: 'VeoBible — Read the Bible',
    template: '%s | VeoBible',
  },
  description: 'A modern Bible reading app with multiple versions.',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0e17' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProduction = process.env.NODE_ENV === 'production'

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${lora.variable}`}>
        {isProduction && (
          <>
            <Script src="https://www.googletagmanager.com/gtag/js?id=G-SFZGL26MS1" strategy="afterInteractive" />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-SFZGL26MS1');
              `}
            </Script>
          </>
        )}

        <QueryProvider>
          <AuthProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
              <ReaderPreferencesProvider>
                {children}
                <ThemeColorUpdater />
                <ToastContainer />
                <PwaUpdateBanner />
              </ReaderPreferencesProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}

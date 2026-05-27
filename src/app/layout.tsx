import type { Metadata, Viewport } from 'next'
import {
  Inter,
  Lora,
  Merriweather,
  EB_Garamond,
  Libre_Baskerville,
  Crimson_Pro,
  Spectral,
  Source_Sans_3,
  Nunito,
  Open_Sans,
} from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from 'next-themes'
import { ToastContainer } from '@/components/ui/Toast'
import { ReaderPreferencesProvider } from '@/hooks/useReaderPreferences'
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

const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-merriweather',
  display: 'swap',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-eb-garamond',
  display: 'swap',
})

const libreBaskerville = Libre_Baskerville({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-libre-baskerville',
  display: 'swap',
})

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-crimson-pro',
  display: 'swap',
})

const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-spectral',
  display: 'swap',
})

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
})

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
})

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://veobible.app'),
  alternates: {
    canonical: '/',
  },
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
  const isProduction = process.env.NODE_ENV === 'production'

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={[
        inter.variable,
        lora.variable,
        merriweather.variable,
        ebGaramond.variable,
        libreBaskerville.variable,
        crimsonPro.variable,
        spectral.variable,
        sourceSans3.variable,
        nunito.variable,
        openSans.variable,
      ].join(' ')}>
        {/* Google Analytics — production only */}
        {isProduction && (
          <>
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-SFZGL26MS1"
              strategy="afterInteractive"
            />
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <ReaderPreferencesProvider>
            {children}
            <ToastContainer />
          </ReaderPreferencesProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

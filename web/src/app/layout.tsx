import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import { cookies } from 'next/headers'
import './globals.css'
import { Navbar } from '@/components/nav/navbar'
import { BottomTabBar } from '@/components/nav/bottom-tab-bar'
import { ToastProvider } from '@/components/ui/toast'
import { PageviewTracker } from '@/components/analytics/pageview-tracker'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const THEME_COOKIE = 'sb-theme'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
  weight: '100 900',
})
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'Saham Bersama',
  description: 'Analisis saham IDX untuk investor Indonesia',
}

function getTheme(value?: string): 'dark' | 'light' {
  return value === 'light' ? 'light' : 'dark'
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const theme = getTheme(cookieStore.get(THEME_COOKIE)?.value)

  return (
    <html lang="id" data-theme={theme}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0C0C0C" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#F2F6FA" media="(prefers-color-scheme: light)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <ToastProvider>
          {/* Desktop top nav — hidden on mobile (bottom tab bar takes over) */}
          <Navbar />
          {/* Main content — 960px max-width centered on desktop, full-bleed on mobile */}
          <div className="w-full sm:max-w-[960px] sm:mx-auto pb-[88px] sm:pb-0">
            {children}
          </div>
          <BottomTabBar />
          <PageviewTracker />
        </ToastProvider>
      </body>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  )
}

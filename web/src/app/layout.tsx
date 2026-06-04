import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google'
import { GoogleAnalytics } from '@next/third-parties/google'
import './globals.css'
import { Navbar } from '@/components/nav/navbar'
import { BottomTabBar } from '@/components/nav/bottom-tab-bar'
import { ToastProvider } from '@/components/ui/toast'
import { PageviewTracker } from '@/components/analytics/pageview-tracker'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" data-theme="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0C0C0C" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#F5F4F1" media="(prefers-color-scheme: light)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Anti-FOUC: runs synchronously before paint to restore saved theme */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var t = localStorage.getItem('sb-theme');
            if (t === 'light' || t === 'dark') {
              document.documentElement.setAttribute('data-theme', t);
            }
          } catch(e) {}
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased`}
      >
        <ToastProvider>
          {/* Desktop top nav — hidden on mobile (bottom tab bar takes over) */}
          <Navbar />
          {/* Main content — padded bottom on mobile to clear the tab bar */}
          <div className="pb-[88px] sm:pb-0">
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

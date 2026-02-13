import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Syne, Poppins } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['400', '500', '600', '700', '800'],
})

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['400', '500', '600', '700', '800', '900'],
})

const phonk = localFont({
  src: '../fonts/Phonk-Regular.otf',
  variable: '--font-phonk',
  display: 'swap',
})
// #region agent log
console.log('[DEBUG] Phonk font variable:', phonk.variable);
// #endregion

export const metadata: Metadata = {
  title: 'Bugtellman — Intelligent QA for Websites',
  description: 'Analyze any website for bugs, issues, accessibility, and more. Drop files or enter a URL.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} ${syne.variable} ${poppins.variable} ${phonk.variable}`}>
      <body className="font-sans antialiased bg-[#1a1b1e] text-zinc-300 min-h-screen">
        {children}
      </body>
    </html>
  )
}

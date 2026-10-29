import type { Metadata } from 'next'
import {
  Anybody,
  Bricolage_Grotesque,
  DM_Sans,
  Fraunces,
  Inter,
  Lora,
  Manrope,
  Playfair_Display,
  Space_Grotesk,
} from 'next/font/google'
import type { CSSProperties, ReactNode } from 'react'
import { brand } from '@/lib/brand'
import { brandingStyle } from '@/lib/branding'
import { site } from '@/lib/site'
import './theme.css'

// Self-hosted by next/font at build time: no request to Google at runtime. Every font in the admin's
// catalogue (lib/branding.ts) is declared here; browsers only download the faces a page actually uses,
// and only the defaults are preloaded.
// (next/font needs each loader call assigned to its own module-scope const.)
const anybody = Anybody({ subsets: ['latin'], axes: ['wdth'], variable: '--rf-ff-anybody', display: 'swap' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--rf-ff-space-grotesk', display: 'swap' })
const inter = Inter({ subsets: ['latin'], variable: '--rf-ff-inter', display: 'swap', preload: false })
const manrope = Manrope({ subsets: ['latin'], variable: '--rf-ff-manrope', display: 'swap', preload: false })
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--rf-ff-dm-sans', display: 'swap', preload: false })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--rf-ff-bricolage-grotesque', display: 'swap', preload: false })
const fraunces = Fraunces({ subsets: ['latin'], variable: '--rf-ff-fraunces', display: 'swap', preload: false })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--rf-ff-playfair-display', display: 'swap', preload: false })
const lora = Lora({ subsets: ['latin'], variable: '--rf-ff-lora', display: 'swap', preload: false })
const fonts = [anybody, spaceGrotesk, inter, manrope, dmSans, bricolage, fraunces, playfair, lora]

// Branding is read from the database at request time, so changes in the admin apply immediately.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { name, iconUrl } = await brand()
  return {
    title: { default: name, template: `%s – ${name}` },
    icons: { icon: iconUrl ?? '/favicon.svg' },
    robots: { index: false, follow: false },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { adminLanguage } = site()
  const branding = await brand()
  return (
    <html
      lang={adminLanguage}
      className={fonts.map((font) => font.variable).join(' ')}
      // rem-based sizes in theme.css scale with this.
      style={{ fontSize: `${branding.typography.baseSize}px` }}
    >
      <body className="rf-root" style={brandingStyle(branding) as CSSProperties}>
        {children}
      </body>
    </html>
  )
}

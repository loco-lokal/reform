import { cache } from 'react'
import { DEFAULT_BRANDING, type Branding } from './branding'
import { getBranding } from './repo'

/**
 * The branding for this request, read once per request. If the database is unreachable the built-in
 * branding is used, so pages still render (the form itself will report the outage).
 */
export const brand = cache(async (): Promise<Branding> => {
  try {
    const { settings, assets } = await getBranding()
    const url = (kind: string, at?: Date) => (at ? `/branding/${kind}?v=${at.getTime()}` : undefined)
    return { ...settings, logoUrl: url('logo', assets.logo), iconUrl: url('icon', assets.icon) }
  } catch (err) {
    console.error('branding: falling back to defaults:', (err as Error).message)
    return DEFAULT_BRANDING
  }
})

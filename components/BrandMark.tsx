import { brand } from '@/lib/brand'

/** The uploaded logo, or the built-in mark: a check inside a rounded square. */
export async function BrandMark({ className }: { className?: string }) {
  const { logoUrl } = await brand()
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- uploaded logo of any size and format, no optimisation needed
    return <img className={className} src={logoUrl} alt="" />
  }
  return (
    <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" focusable="false">
      <path
        fillRule="evenodd"
        d="M28 4h44a24 24 0 0 1 24 24v44a24 24 0 0 1-24 24H28A24 24 0 0 1 4 72V28A24 24 0 0 1 28 4Zm0 10a14 14 0 0 0-14 14v44a14 14 0 0 0 14 14h44a14 14 0 0 0 14-14V28a14 14 0 0 0-14-14Z"
      />
      <path d="m27 50 8-8 10 10 21-21 8 8-29 29Z" />
    </svg>
  )
}

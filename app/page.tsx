import { redirect } from 'next/navigation'
import { brand } from '@/lib/brand'

// The root has no content of its own: send visitors to the operator's website, or to the admin.
export default async function Home() {
  redirect((await brand()).siteUrl ?? '/admin')
}

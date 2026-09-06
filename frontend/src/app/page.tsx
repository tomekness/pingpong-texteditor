import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export default function Home() {
  const id = randomBytes(7).toString('base64url')
  redirect(`/doc/${id}`)
}

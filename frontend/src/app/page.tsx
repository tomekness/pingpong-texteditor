import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'

// Old homepage (document list) preserved in git history.
// Now: visiting / creates a new ephemeral doc with a random unguessable ID.
export default function Home() {
  const id = randomBytes(7).toString('base64url')
  redirect(`/doc/${id}`)
}

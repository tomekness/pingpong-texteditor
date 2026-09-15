import type { Metadata } from 'next'
import localFont from 'next/font/local'
import '../styles/globals.css'

const inter = localFont({
  src: '../../public/fonts/inter-var.woff2',
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pingpong',
  description: 'Collaborative text editing with your LLM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}

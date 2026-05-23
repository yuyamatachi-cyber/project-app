import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LinkBPO Dashboard',
  description: 'Project Management Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}

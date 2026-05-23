import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'プロジェクト Dashboard',
  description: 'Project Management Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-[#1a1a1a] text-white min-h-screen">
        {children}
      </body>
    </html>
  )
}

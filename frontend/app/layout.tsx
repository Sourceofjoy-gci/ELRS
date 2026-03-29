import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ELRI - Eswatini Legal Research Intelligence',
  description: 'Query Acts of Parliament, the Constitution, and case law using natural language. Every query is processed entirely on local hardware.',
  keywords: ['legal research', 'Eswatini', 'law', 'acts', 'parliament', 'AI'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ORA AI Dashboard',
  description: 'AI Agent Analytics & Testing',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} bg-gray-950 text-white min-h-screen`}>
        <nav className="border-b border-gray-800 bg-gray-900 px-6 py-3 flex items-center justify-between">
          <span className="text-lg font-bold text-orange-400">🟠 ORA AI Dashboard</span>
          <div className="flex gap-1">
            <Link href="/" className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
              📊 Dashboard
            </Link>
            <Link href="/test" className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">
              🧪 Test Agent
            </Link>
          </div>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  )
}

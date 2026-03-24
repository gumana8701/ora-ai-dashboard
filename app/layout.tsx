import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import Image from 'next/image'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Dr. CEO App — Dashboard',
  description: 'AI Agent Analytics & Testing',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} bg-gray-50 text-gray-900 min-h-screen`}>
        <nav className="border-b border-gray-200 bg-white px-6 py-3 flex items-center justify-between shadow-sm">
          <Image src="/drceo-logo.png" alt="Dr. CEO App" width={140} height={40} className="object-contain" priority />
          <div className="flex gap-1">
            <Link href="/" className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium transition-colors">
              📊 Dashboard
            </Link>
            <Link href="/test" className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium transition-colors">
              🧪 Test Agent
            </Link>
          </div>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  )
}

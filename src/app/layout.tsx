import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { signOut } from '@/auth'
import { currentAdmin } from '@/lib/admin'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import ThemeProvider from '@/components/ThemeProvider'

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SHPE @ Colorado Mesa University',
  description:
    'Society of Hispanic Professional Engineers — Colorado Mesa University Chapter. Empowering Hispanic STEM professionals in Grand Junction, CO.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin()

  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="websitelaunches-verification" content="b6a2583caccd14a46aef1d20effe4c93" />
        {/* Runs synchronously before paint to avoid flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <Navbar
            user={admin ? { name: admin.user.name ?? 'Admin' } : null}
            signOutAction={signOutAction}
          />
          <main className="min-h-screen">{children}</main>
          <Footer editable={Boolean(admin)} />
        </ThemeProvider>
      </body>
    </html>
  )
}

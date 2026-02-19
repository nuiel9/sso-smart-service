import type { Metadata } from 'next'
import { Geist, Geist_Mono, Noto_Sans_Thai } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// ฟอนต์ภาษาไทยหลัก — Noto Sans Thai รองรับอักษรไทยครบถ้วน
const notoSansThai = Noto_Sans_Thai({
  variable: '--font-noto-sans-thai',
  subsets: ['thai'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'SSO Smart Service | ระบบบริการอัจฉริยะสำนักงานประกันสังคม',
    template: '%s | SSO Smart Service',
  },
  description:
    'ระบบบริการอัจฉริยะสำนักงานประกันสังคม รองรับผู้ประกันตนมาตรา 33, 39 และ 40',
  keywords: ['ประกันสังคม', 'SSO', 'สิทธิประโยชน์', 'AI chatbot'],
  robots: { index: false }, // ไม่ให้ search engine index เนื่องจากเป็นระบบภายใน
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // lang="th" เพื่อ screen reader ออกเสียงภาษาไทยถูกต้อง
    <html lang="th">
      <body
        className={`${notoSansThai.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
        // Noto Sans Thai นำหน้า เพื่อให้ภาษาไทย render ด้วยฟอนต์ที่ถูกต้อง
        style={{
          fontFamily:
            'var(--font-noto-sans-thai), var(--font-geist-sans), sans-serif',
        }}
      >
        {children}
        {/* Global toast notifications */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}

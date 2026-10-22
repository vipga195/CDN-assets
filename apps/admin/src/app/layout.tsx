import type { Metadata } from 'next'
import './globals.css'
import { SITE_URL } from '../services/lib/site'
import Header from '../components/common/header'
import Footer from '../components/common/footer'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'imgcdn', template: '%s | imgcdn' },
  robots: { index: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Header />
        <div className='px-6 py-10 max-w-360 w-full mx-auto'>
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}

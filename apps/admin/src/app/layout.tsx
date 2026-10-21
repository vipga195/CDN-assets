export const metadata = { title: 'imgcdn admin', robots: { index: false } }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
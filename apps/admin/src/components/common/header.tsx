import Link from "next/link";

const navLinks = [
  { href: "/assets", label: "Thư viện ảnh" },
  { href: "/users", label: "Người dùng" },
  { href: "/docs", label: "Tài liệu" },
];

export default function Header() {
  return (
    <header className="w-full sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-360 w-full mx-auto px-6 h-20 flex items-center justify-between gap-8">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-lg bg-slate-900" aria-hidden="true" />
          <span className="text-lg font-bold text-slate-900">CDN</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-[15px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 shrink-0">
          <Link
            href="/login"
            className="text-[15px] font-semibold text-slate-700 hover:text-slate-900 transition-colors"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-[15px] font-semibold hover:bg-slate-700 transition-colors"
          >
            Đăng ký
          </Link>
        </div>
      </div>
    </header>
  );
}

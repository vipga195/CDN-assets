import Link from "next/link";

const footerColumns = [
  {
    title: "Sản phẩm",
    links: [
      { href: "/assets", label: "Thư viện ảnh" },
      { href: "/docs", label: "Tài liệu" },
    ],
  },
  {
    title: "Tài khoản",
    links: [
      { href: "/login", label: "Đăng nhập" },
      { href: "/register", label: "Đăng ký" },
      { href: "/users", label: "Người dùng" },
    ],
  },
  {
    title: "Công ty",
    links: [
      { href: "/", label: "Trang chủ" },
      { href: "/docs", label: "Tài liệu API" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="w-full bg-slate-950 text-slate-300">
      <div className="max-w-360 w-full mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
        <div className="col-span-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-white" aria-hidden="true" />
            <span className="text-lg font-bold text-white">imgcdn</span>
          </Link>
          <p className="mt-4 text-sm text-slate-400 max-w-xs">
            Nền tảng lưu trữ và tối ưu hình ảnh qua CDN.
          </p>
        </div>

        {footerColumns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-white">{col.title}</h3>
            <ul className="mt-4 space-y-3">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-800">
        <div className="max-w-360 w-full mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} imgcdn. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-slate-300 transition-colors">
              Điều khoản
            </Link>
            <Link href="/docs" className="hover:text-slate-300 transition-colors">
              Bảo mật
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

import Link from 'next/link'
import { signOut } from '../login/actions'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <nav className="flex gap-4 text-sm font-medium text-neutral-700">
          <Link href="/admin/productos">Productos</Link>
          <Link href="/admin/puntos-venta">Puntos de venta</Link>
        </nav>
        <form action={signOut}>
          <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-900">
            Salir
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}

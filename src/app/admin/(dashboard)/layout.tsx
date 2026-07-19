import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'
import { obtenerRolActual } from '@/lib/admin/auth'
import { signOut } from '../login/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerRolActual()
  const esAdmin = sesion?.rol !== 'empleado'

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-6">
          <BrandMark />
          <nav className="flex gap-4 text-sm font-medium text-neutral-700">
            <Link href="/admin/pedidos">Pedidos</Link>
            {esAdmin && (
              <>
                <Link href="/admin/productos">Productos</Link>
                <Link href="/admin/puntos-venta">Puntos de venta</Link>
                <Link href="/admin/excepciones">Excepciones de corte</Link>
                <Link href="/admin/usuarios">Usuarios</Link>
                <Link href="/admin/configuracion">Configuración</Link>
              </>
            )}
          </nav>
        </div>
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

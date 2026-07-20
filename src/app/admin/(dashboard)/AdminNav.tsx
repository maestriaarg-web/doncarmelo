'use client'

import { useState } from 'react'
import Link from 'next/link'

export function AdminNav({ esAdmin }: { esAdmin: boolean }) {
  const [abierto, setAbierto] = useState(false)

  const links = (
    <>
      <Link href="/admin/pedidos" onClick={() => setAbierto(false)}>
        Pedidos
      </Link>
      {esAdmin && (
        <>
          <Link href="/admin/productos" onClick={() => setAbierto(false)}>
            Productos
          </Link>
          <Link href="/admin/puntos-venta" onClick={() => setAbierto(false)}>
            Puntos de venta
          </Link>
          <Link href="/admin/excepciones" onClick={() => setAbierto(false)}>
            Excepciones de corte
          </Link>
          <Link href="/admin/usuarios" onClick={() => setAbierto(false)}>
            Usuarios
          </Link>
          <Link href="/admin/configuracion" onClick={() => setAbierto(false)}>
            Configuración
          </Link>
        </>
      )}
    </>
  )

  return (
    <div className="relative">
      <nav className="hidden gap-4 text-sm font-medium text-neutral-700 md:flex">{links}</nav>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="text-2xl leading-none text-neutral-700 md:hidden"
        aria-label="Abrir menú"
        aria-expanded={abierto}
      >
        ☰
      </button>
      {abierto && (
        <nav className="absolute left-0 top-full z-10 mt-2 flex w-56 flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-2 text-sm font-medium text-neutral-700 shadow-lg md:hidden">
          {links}
        </nav>
      )}
    </div>
  )
}

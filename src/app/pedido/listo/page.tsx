'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ItemCarrito } from '@/lib/types'

const ULTIMO_PEDIDO_KEY = 'don_carmelo_ultimo_pedido'

type ResumenPedido = {
  items: ItemCarrito[]
  fechaEntrega: string
  turno: 'manana' | 'tarde'
  tipoEtiqueta: 'grande' | 'chica' | 'ambas'
}

const ETIQUETA_LABEL: Record<ResumenPedido['tipoEtiqueta'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export default function ListoPage() {
  const router = useRouter()
  const [resumen, setResumen] = useState<ResumenPedido | null | 'cargando'>('cargando')

  useEffect(() => {
    // Hydrating client-only sessionStorage into state on mount; must run in an
    // effect to avoid SSR mismatch (sessionStorage is unavailable during SSR).
    const guardado = sessionStorage.getItem(ULTIMO_PEDIDO_KEY)
    if (!guardado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResumen(null)
      return
    }
    try {
      setResumen(JSON.parse(guardado))
    } catch {
      setResumen(null)
    }
  }, [])

  if (resumen === 'cargando') return null

  if (!resumen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-neutral-500">No encontramos un pedido reciente.</p>
        <button
          onClick={() => router.push('/pedido')}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white"
        >
          Ir al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 p-4 text-center">
      <div className="text-5xl">✅</div>
      <h1 className="text-2xl font-bold text-neutral-900">¡Pedido confirmado!</h1>
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-4 text-left">
        <p className="mb-1 text-base text-neutral-900">
          <strong>Fecha de entrega:</strong> {resumen.fechaEntrega}
        </p>
        <p className="mb-1 text-base text-neutral-900">
          <strong>Reparto:</strong> {resumen.turno === 'manana' ? 'Mañana' : 'Tarde'}
        </p>
        <p className="mb-3 text-base text-neutral-900">
          <strong>Etiqueta:</strong> {ETIQUETA_LABEL[resumen.tipoEtiqueta]}
        </p>
        <ul className="space-y-1 text-sm text-neutral-600">
          {resumen.items.map((item) => (
            <li key={item.productoId}>
              {item.cantidad} {item.unidad} — {item.nombre}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={() => router.push('/pedido')}
        className="rounded-md bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-800"
      >
        Hacer otro pedido
      </button>
    </div>
  )
}

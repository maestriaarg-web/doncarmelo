'use client'

import { useState } from 'react'
import type { ActionResult } from '@/lib/types'
import { marcarPreparado, marcarEntregado, cancelarPedido } from './actions'

const ESTADO_BADGE: Partial<
  Record<'preparado' | 'entregado' | 'cancelado', { label: string; className: string }>
> = {
  preparado: { label: 'Preparado', className: 'bg-neutral-200 text-neutral-700' },
  entregado: { label: '✓ Entregado', className: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 line-through' },
}

export function EstadoPedidoAcciones({
  pedidoId,
  estado,
}: {
  pedidoId: string
  estado: 'confirmado' | 'preparado' | 'entregado' | 'cancelado'
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ejecutar(accion: (id: string) => Promise<ActionResult>) {
    setCargando(true)
    setError(null)
    const resultado = await accion(pedidoId)
    if ('error' in resultado) setError(resultado.error)
    setCargando(false)
  }

  function handleCancelar() {
    if (!confirm('¿Seguro que querés cancelar este pedido?')) return
    ejecutar(cancelarPedido)
  }

  const badge = estado === 'confirmado' ? null : ESTADO_BADGE[estado]
  const puedeCancelar = estado !== 'entregado' && estado !== 'cancelado'

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {badge && (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
      {estado === 'confirmado' && (
        <button
          onClick={() => ejecutar(marcarPreparado)}
          disabled={cargando}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-50"
        >
          Marcar preparado
        </button>
      )}
      {estado === 'preparado' && (
        <button
          onClick={() => ejecutar(marcarEntregado)}
          disabled={cargando}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-50"
        >
          Marcar entregado
        </button>
      )}
      {puedeCancelar && (
        <button
          onClick={handleCancelar}
          disabled={cargando}
          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Cancelar
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

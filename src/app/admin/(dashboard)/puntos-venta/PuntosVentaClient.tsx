'use client'

import { useState } from 'react'
import type { PuntoVenta } from '@/lib/types'
import { PuntoVentaForm } from './PuntoVentaForm'
import {
  crearPuntoVenta,
  actualizarPuntoVenta,
  cambiarActivoPuntoVenta,
  type PuntoVentaInput,
} from './actions'

const ETIQUETA_LABEL: Record<PuntoVenta['etiqueta_default'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function PuntosVentaClient({ puntosVenta }: { puntosVenta: PuntoVenta[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<PuntoVenta | null>(null)

  async function handleCrear(input: PuntoVentaInput) {
    await crearPuntoVenta(input)
    setModo('lista')
  }

  async function handleActualizar(input: PuntoVentaInput) {
    if (!editando) return
    await actualizarPuntoVenta(editando.id, input)
    setModo('lista')
    setEditando(null)
  }

  async function handleCambiarActivo(id: string, activo: boolean) {
    try {
      await cambiarActivoPuntoVenta(id, activo)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar el estado')
    }
  }

  if (modo === 'nuevo') {
    return <PuntoVentaForm onSubmit={handleCrear} onCancel={() => setModo('lista')} />
  }

  if (modo === 'editar' && editando) {
    return (
      <PuntoVentaForm
        puntoVenta={editando}
        onSubmit={handleActualizar}
        onCancel={() => {
          setModo('lista')
          setEditando(null)
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Puntos de venta</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white hover:bg-neutral-800"
        >
          + Nuevo punto de venta
        </button>
      </div>

      <ul className="space-y-2">
        {puntosVenta.map((pv) => (
          <li
            key={pv.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[12rem] flex-1">
              <p className="font-medium text-neutral-900">{pv.nombre}</p>
              <p className="text-sm text-neutral-500">
                Código: {pv.codigo_acceso} · {ETIQUETA_LABEL[pv.etiqueta_default]}
                {pv.pedido_minimo != null && ` · Mínimo $${pv.pedido_minimo}`}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={pv.activo}
                onChange={(e) => handleCambiarActivo(pv.id, e.target.checked)}
              />
              Activo
            </label>
            <button
              onClick={() => {
                setEditando(pv)
                setModo('editar')
              }}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Editar
            </button>
          </li>
        ))}
        {puntosVenta.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay puntos de venta cargados.</p>
        )}
      </ul>
    </div>
  )
}

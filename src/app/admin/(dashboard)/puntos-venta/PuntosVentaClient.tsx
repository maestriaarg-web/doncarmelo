'use client'

import { useState } from 'react'
import type { ActionResult, PuntoVenta } from '@/lib/types'
import { PuntoVentaForm } from './PuntoVentaForm'
import {
  crearPuntoVenta,
  actualizarPuntoVenta,
  cambiarActivoPuntoVenta,
  type PuntoVentaInput,
} from './actions'

const SIN_ZONA = 'Sin zona'

const ETIQUETA_LABEL: Record<PuntoVenta['etiqueta_default'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function PuntosVentaClient({ puntosVenta }: { puntosVenta: PuntoVenta[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<PuntoVenta | null>(null)
  const [filtroZona, setFiltroZona] = useState('todas')

  const zonasExistentes = Array.from(
    new Set(puntosVenta.filter((pv) => pv.zona).map((pv) => pv.zona as string))
  )
  const zonasFiltro = Array.from(new Set(puntosVenta.map((pv) => pv.zona || SIN_ZONA)))
  const visibles = puntosVenta.filter(
    (pv) => filtroZona === 'todas' || (pv.zona || SIN_ZONA) === filtroZona
  )

  async function handleCrear(input: PuntoVentaInput): Promise<ActionResult> {
    const result = await crearPuntoVenta(input)
    if ('success' in result) setModo('lista')
    return result
  }

  async function handleActualizar(input: PuntoVentaInput): Promise<ActionResult> {
    if (!editando) return { error: 'No hay punto de venta seleccionado' }
    const result = await actualizarPuntoVenta(editando.id, input)
    if ('success' in result) {
      setModo('lista')
      setEditando(null)
    }
    return result
  }

  async function handleCambiarActivo(id: string, activo: boolean) {
    const result = await cambiarActivoPuntoVenta(id, activo)
    if ('error' in result) alert(result.error)
  }

  if (modo === 'nuevo') {
    return (
      <PuntoVentaForm
        zonasExistentes={zonasExistentes}
        onSubmit={handleCrear}
        onCancel={() => setModo('lista')}
      />
    )
  }

  if (modo === 'editar' && editando) {
    return (
      <PuntoVentaForm
        puntoVenta={editando}
        zonasExistentes={zonasExistentes}
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
        <h1 className="text-xl font-semibold text-foreground">Puntos de venta</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
        >
          + Nuevo punto de venta
        </button>
      </div>

      {zonasFiltro.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFiltroZona('todas')}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              filtroZona === 'todas' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Todas
          </button>
          {zonasFiltro.map((z) => (
            <button
              key={z}
              onClick={() => setFiltroZona(z)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                filtroZona === z ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {visibles.map((pv) => (
          <li
            key={pv.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[12rem] flex-1">
              <p className="font-medium text-foreground">{pv.nombre}</p>
              <p className="text-sm text-neutral-500">
                Celular: {pv.celular} · {ETIQUETA_LABEL[pv.etiqueta_default]} · Zona:{' '}
                {pv.zona || SIN_ZONA}
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
        {visibles.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay puntos de venta en esta zona.</p>
        )}
      </ul>
    </div>
  )
}

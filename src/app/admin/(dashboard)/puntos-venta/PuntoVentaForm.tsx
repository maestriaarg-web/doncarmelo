'use client'

import { useState, type FormEvent } from 'react'
import type { ActionResult, PuntoVenta } from '@/lib/types'
import type { PuntoVentaInput } from './actions'

export function PuntoVentaForm({
  puntoVenta,
  onSubmit,
  onCancel,
}: {
  puntoVenta?: PuntoVenta
  onSubmit: (input: PuntoVentaInput) => Promise<ActionResult>
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(puntoVenta?.nombre ?? '')
  const [direccion, setDireccion] = useState(puntoVenta?.direccion ?? '')
  const [contacto, setContacto] = useState(puntoVenta?.contacto ?? '')
  const [codigoAcceso, setCodigoAcceso] = useState(puntoVenta?.codigo_acceso ?? '')
  const [etiquetaDefault, setEtiquetaDefault] = useState<PuntoVentaInput['etiqueta_default']>(
    puntoVenta?.etiqueta_default ?? 'ambas'
  )
  const [pedidoMinimo, setPedidoMinimo] = useState(
    puntoVenta?.pedido_minimo != null ? String(puntoVenta.pedido_minimo) : ''
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const result = await onSubmit({
      nombre,
      direccion: direccion || null,
      contacto: contacto || null,
      codigo_acceso: codigoAcceso,
      etiqueta_default: etiquetaDefault,
      pedido_minimo: pedidoMinimo ? Number(pedidoMinimo) : null,
    })
    if ('error' in result) {
      setError(
        result.error.includes('duplicate key')
          ? 'Ese código de acceso ya está en uso por otro punto de venta.'
          : result.error
      )
      setGuardando(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Dirección</label>
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Contacto</label>
        <input
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Teléfono o WhatsApp"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Código de acceso</label>
        <input
          value={codigoAcceso}
          onChange={(e) => setCodigoAcceso(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Etiqueta por defecto
          </label>
          <select
            value={etiquetaDefault}
            onChange={(e) =>
              setEtiquetaDefault(e.target.value as PuntoVentaInput['etiqueta_default'])
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          >
            <option value="grande">Grande sin precio</option>
            <option value="chica">Chica con precio sugerido</option>
            <option value="ambas">Ambas</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Pedido mínimo (opcional)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={pedidoMinimo}
            onChange={(e) => setPedidoMinimo(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-base font-medium text-neutral-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

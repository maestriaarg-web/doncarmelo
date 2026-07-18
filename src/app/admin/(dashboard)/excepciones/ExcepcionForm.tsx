'use client'

import { useState, type FormEvent } from 'react'
import type { ActionResult, ExcepcionCorte } from '@/lib/types'
import type { ExcepcionCorteInput } from './actions'

export function ExcepcionForm({
  excepcion,
  onSubmit,
  onCancel,
}: {
  excepcion?: ExcepcionCorte
  onSubmit: (input: ExcepcionCorteInput) => Promise<ActionResult>
  onCancel: () => void
}) {
  const [fecha, setFecha] = useState(excepcion?.fecha ?? '')
  const [horaCorte, setHoraCorte] = useState(excepcion?.hora_corte ?? '09:00')
  const [motivo, setMotivo] = useState(excepcion?.motivo ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const result = await onSubmit({
      fecha,
      hora_corte: horaCorte,
      motivo: motivo || null,
    })
    if ('error' in result) {
      setError(
        result.error.includes('duplicate key')
          ? 'Ya hay una excepción cargada para esa fecha.'
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
        <label className="mb-1 block text-sm font-medium text-neutral-700">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Hora de corte</label>
        <input
          type="time"
          value={horaCorte}
          onChange={(e) => setHoraCorte(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Motivo (opcional)
        </label>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: Feriado 9 de julio"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
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

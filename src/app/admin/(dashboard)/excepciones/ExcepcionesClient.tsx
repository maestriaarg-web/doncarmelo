'use client'

import { useState } from 'react'
import type { ExcepcionCorte } from '@/lib/types'
import { ExcepcionForm } from './ExcepcionForm'
import {
  crearExcepcion,
  actualizarExcepcion,
  borrarExcepcion,
  type ExcepcionCorteInput,
} from './actions'

export function ExcepcionesClient({ excepciones }: { excepciones: ExcepcionCorte[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<ExcepcionCorte | null>(null)

  async function handleCrear(input: ExcepcionCorteInput) {
    const result = await crearExcepcion(input)
    if ('success' in result) setModo('lista')
    return result
  }

  async function handleActualizar(input: ExcepcionCorteInput) {
    if (!editando) return { error: 'No hay excepción seleccionada' }
    const result = await actualizarExcepcion(editando.id, input)
    if ('success' in result) {
      setModo('lista')
      setEditando(null)
    }
    return result
  }

  async function handleBorrar(id: string) {
    const result = await borrarExcepcion(id)
    if ('error' in result) alert(result.error)
  }

  if (modo === 'nuevo') {
    return <ExcepcionForm onSubmit={handleCrear} onCancel={() => setModo('lista')} />
  }

  if (modo === 'editar' && editando) {
    return (
      <ExcepcionForm
        excepcion={editando}
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
        <h1 className="text-xl font-semibold text-foreground">Excepciones de corte</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
        >
          + Nueva excepción
        </button>
      </div>

      <ul className="space-y-2">
        {excepciones.map((excepcion) => (
          <li
            key={excepcion.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[10rem] flex-1">
              <p className="font-medium text-foreground">{excepcion.fecha}</p>
              <p className="text-sm text-neutral-500">
                Corte: {excepcion.hora_corte}
                {excepcion.motivo && ` · ${excepcion.motivo}`}
              </p>
            </div>
            <button
              onClick={() => {
                setEditando(excepcion)
                setModo('editar')
              }}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Editar
            </button>
            <button
              onClick={() => handleBorrar(excepcion.id)}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Borrar
            </button>
          </li>
        ))}
        {excepciones.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay excepciones cargadas.</p>
        )}
      </ul>
    </div>
  )
}

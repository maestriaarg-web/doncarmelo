// src/app/admin/(dashboard)/configuracion/ConfiguracionForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import type { Configuracion } from '@/lib/types'
import { actualizarBackupEmail } from './actions'

export function ConfiguracionForm({ configuracion }: { configuracion: Configuracion }) {
  const [backupEmail, setBackupEmail] = useState(configuracion.backup_email ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)
    const result = await actualizarBackupEmail(backupEmail || null)
    if ('error' in result) {
      setError(result.error)
    } else {
      setGuardado(true)
    }
    setGuardando(false)
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-foreground">Configuración</h1>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      >
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {guardado && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Guardado.</p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Email para el backup semanal
          </label>
          <input
            type="email"
            value={backupEmail}
            onChange={(e) => setBackupEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
          <p className="mt-1 text-sm text-neutral-500">
            Todos los domingos a la noche se manda a esta casilla un Excel con los puntos de
            venta, el catálogo y los pedidos de la semana. Dejalo vacío para no mandar nada.
          </p>
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

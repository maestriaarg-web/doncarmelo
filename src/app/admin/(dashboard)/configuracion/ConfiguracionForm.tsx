// src/app/admin/(dashboard)/configuracion/ConfiguracionForm.tsx
'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Configuracion } from '@/lib/types'
import { actualizarConfiguracion } from './actions'

const LISTA_PRECIOS_PATH = '0fff5c3f-7b04-4bef-89c6-67c29beeb86c/lista-precios.pdf'

export function ConfiguracionForm({ configuracion }: { configuracion: Configuracion }) {
  const [backupEmail, setBackupEmail] = useState(configuracion.backup_email ?? '')
  const [listaPreciosUrl, setListaPreciosUrl] = useState(configuracion.lista_precios_url ?? '')
  const [videoEmbalajeUrl, setVideoEmbalajeUrl] = useState(configuracion.video_embalaje_url ?? '')
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function handleListaPreciosChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSubiendo(true)
    setError(null)
    try {
      const supabase = createClient()
      const path = LISTA_PRECIOS_PATH
      const { error: uploadError } = await supabase.storage
        .from('listas-precios')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('listas-precios').getPublicUrl(path)
      setListaPreciosUrl(`${data.publicUrl}?v=${Date.now()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la lista de precios')
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)
    const result = await actualizarConfiguracion({
      backup_email: backupEmail || null,
      lista_precios_url: listaPreciosUrl || null,
      video_embalaje_url: videoEmbalajeUrl || null,
    })
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
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Lista de precios actualizada
          </label>
          <input
            type="file"
            onChange={handleListaPreciosChange}
            disabled={subiendo}
            className="w-full text-sm"
          />
          {subiendo && <p className="mt-1 text-sm text-neutral-500">Subiendo...</p>}
          {listaPreciosUrl && !subiendo && (
            <p className="mt-1 text-sm text-neutral-500">
              Archivo cargado.{' '}
              <a
                href={listaPreciosUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Ver actual
              </a>
            </p>
          )}
          <p className="mt-1 text-sm text-neutral-500">
            Los comercios ven un botón para descargar este archivo. Subir uno nuevo lo reemplaza
            al instante, ni bien lo elegís (no hace falta tocar &quot;Guardar&quot; para eso).
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Video de embalaje (link de YouTube)
          </label>
          <input
            type="text"
            value={videoEmbalajeUrl}
            onChange={(e) => setVideoEmbalajeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
          <p className="mt-1 text-sm text-neutral-500">
            Pegá el link tal cual lo copiás de &quot;Compartir&quot; en YouTube. Dejalo vacío para
            no mostrar ningún video.
          </p>
        </div>
        <button
          type="submit"
          disabled={guardando || subiendo}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}

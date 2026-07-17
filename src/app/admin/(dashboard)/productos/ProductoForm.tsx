'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Producto } from '@/lib/types'
import type { ProductoInput } from './actions'

export function ProductoForm({
  producto,
  categoriasExistentes,
  onSubmit,
  onCancel,
}: {
  producto?: Producto
  categoriasExistentes: string[]
  onSubmit: (input: ProductoInput) => Promise<void>
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [categoria, setCategoria] = useState(producto?.categoria ?? '')
  const [unidad, setUnidad] = useState(producto?.unidad ?? '')
  const [precioSugerido, setPrecioSugerido] = useState(
    producto?.precio_sugerido != null ? String(producto.precio_sugerido) : ''
  )
  const [congelado, setCongelado] = useState(producto?.congelado ?? false)
  const [disponible, setDisponible] = useState(producto?.disponible ?? true)
  const [fotoUrl, setFotoUrl] = useState<string | null>(producto?.foto_url ?? null)
  const [subiendo, setSubiendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSubiendo(true)
    setError(null)
    try {
      const supabase = createClient()
      const path = `${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(path, file, { upsert: false })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('productos').getPublicUrl(path)
      setFotoUrl(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la foto')
    } finally {
      setSubiendo(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await onSubmit({
        nombre,
        categoria,
        unidad,
        precio_sugerido: precioSugerido ? Number(precioSugerido) : null,
        congelado,
        disponible,
        foto_url: fotoUrl,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Categoría</label>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            required
            list="categorias-datalist"
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
          <datalist id="categorias-datalist">
            {categoriasExistentes.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Unidad</label>
          <input
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            required
            placeholder="kg, unidad, paquete..."
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Precio sugerido (opcional)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={precioSugerido}
          onChange={(e) => setPrecioSugerido(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={congelado}
            onChange={(e) => setCongelado(e.target.checked)}
          />
          Congelado
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
          <input
            type="checkbox"
            checked={disponible}
            onChange={(e) => setDisponible(e.target.checked)}
          />
          Disponible
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Foto</label>
        {fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt="" className="mb-2 h-24 w-24 rounded-md object-cover" />
        )}
        <input type="file" accept="image/*" onChange={handleFotoChange} disabled={subiendo} />
        {subiendo && <p className="mt-1 text-sm text-neutral-500">Subiendo...</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={guardando || subiendo}
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

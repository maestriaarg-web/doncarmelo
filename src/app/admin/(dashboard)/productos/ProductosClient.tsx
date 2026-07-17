'use client'

import { useState } from 'react'
import type { Producto } from '@/lib/types'
import { ProductoForm } from './ProductoForm'
import {
  crearProducto,
  actualizarProducto,
  darDeBajaProducto,
  toggleDisponible,
  type ProductoInput,
} from './actions'

export function ProductosClient({ productos }: { productos: Producto[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState('todas')

  const activos = productos.filter((p) => p.activo)
  const categorias = Array.from(new Set(activos.map((p) => p.categoria)))
  const visibles = activos.filter(
    (p) => filtroCategoria === 'todas' || p.categoria === filtroCategoria
  )

  async function handleCrear(input: ProductoInput) {
    await crearProducto(input)
    setModo('lista')
  }

  async function handleActualizar(input: ProductoInput) {
    if (!editando) return
    await actualizarProducto(editando.id, input)
    setModo('lista')
    setEditando(null)
  }

  async function handleToggleDisponible(id: string, disponible: boolean) {
    try {
      await toggleDisponible(id, disponible)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar disponibilidad')
    }
  }

  async function handleDarDeBaja(id: string) {
    try {
      await darDeBajaProducto(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al dar de baja el producto')
    }
  }

  if (modo === 'nuevo') {
    return (
      <ProductoForm
        categoriasExistentes={categorias}
        onSubmit={handleCrear}
        onCancel={() => setModo('lista')}
      />
    )
  }

  if (modo === 'editar' && editando) {
    return (
      <ProductoForm
        producto={editando}
        categoriasExistentes={categorias}
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
        <h1 className="text-xl font-semibold text-neutral-900">Productos</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white hover:bg-neutral-800"
        >
          + Nuevo producto
        </button>
      </div>

      {categorias.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFiltroCategoria('todas')}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              filtroCategoria === 'todas' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(c)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                filtroCategoria === c ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {visibles.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            {p.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.foto_url} alt="" className="h-12 w-12 rounded-md object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-md bg-neutral-100" />
            )}
            <div className="min-w-[10rem] flex-1">
              <p className="font-medium text-neutral-900">
                {p.nombre} {p.congelado && <span className="text-xs text-blue-600">❄ congelado</span>}
              </p>
              <p className="text-sm text-neutral-500">
                {p.categoria} · {p.unidad}
                {p.precio_sugerido != null && ` · $${p.precio_sugerido}`}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={p.disponible}
                onChange={(e) => handleToggleDisponible(p.id, e.target.checked)}
              />
              Disponible
            </label>
            <button
              onClick={() => {
                setEditando(p)
                setModo('editar')
              }}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Editar
            </button>
            <button
              onClick={() => handleDarDeBaja(p.id)}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Baja
            </button>
          </li>
        ))}
        {visibles.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay productos en esta categoría.</p>
        )}
      </ul>
    </div>
  )
}

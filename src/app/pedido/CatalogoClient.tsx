'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Producto, ItemCarrito } from '@/lib/types'
import { repetirUltimoPedido } from './actions'

const CARRITO_KEY = 'don_carmelo_carrito'
const AVISO_KEY = 'don_carmelo_aviso'

export function CatalogoClient({
  productos,
  hayHistorial,
}: {
  productos: Producto[]
  hayHistorial: boolean
}) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargado, setCargado] = useState(false)
  const [repitiendo, setRepitiendo] = useState(false)

  useEffect(() => {
    const guardado = sessionStorage.getItem(CARRITO_KEY)
    if (guardado) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCarrito(JSON.parse(guardado))
      } catch {
        // carrito corrupto en sessionStorage, se ignora y arranca vacío
      }
    }
    setCargado(true)
  }, [])

  useEffect(() => {
    if (cargado) sessionStorage.setItem(CARRITO_KEY, JSON.stringify(carrito))
  }, [carrito, cargado])

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    if (!termino) return productos
    return productos.filter((p) => p.nombre.toLowerCase().includes(termino))
  }, [productos, busqueda])

  const categorias = useMemo(() => {
    const mapa = new Map<string, Producto[]>()
    for (const p of productosFiltrados) {
      const lista = mapa.get(p.categoria) ?? []
      lista.push(p)
      mapa.set(p.categoria, lista)
    }
    return Array.from(mapa.entries())
  }, [productosFiltrados])

  function cantidadEnCarrito(productoId: string): number {
    return carrito.find((i) => i.productoId === productoId)?.cantidad ?? 0
  }

  function actualizarCantidad(producto: Producto, cantidad: number) {
    setCarrito((actual) => {
      const sinEste = actual.filter((i) => i.productoId !== producto.id)
      if (cantidad <= 0) return sinEste
      return [
        ...sinEste,
        {
          productoId: producto.id,
          nombre: producto.nombre,
          unidad: producto.unidad,
          precioSugerido: producto.precio_sugerido,
          cantidad,
        },
      ]
    })
  }

  async function handleRepetirPedido() {
    setRepitiendo(true)
    const resultado = await repetirUltimoPedido()
    if ('error' in resultado) {
      alert(resultado.error)
      setRepitiendo(false)
      return
    }
    sessionStorage.setItem(CARRITO_KEY, JSON.stringify(resultado.items))
    if (resultado.omitidos > 0) {
      sessionStorage.setItem(
        AVISO_KEY,
        `${resultado.omitidos} producto(s) de tu último pedido ya no están disponibles y no se agregaron.`
      )
    }
    router.push('/pedido/confirmar')
  }

  const totalItems = carrito.reduce((acc, i) => acc + i.cantidad, 0)
  const totalPrecio = carrito.reduce(
    (acc, i) => acc + (i.precioSugerido != null ? i.precioSugerido * i.cantidad : 0),
    0
  )

  return (
    <div className="pb-24">
      <div className="flex justify-end px-4 pt-3">
        <Link href="/pedido/historial" className="text-sm font-medium text-neutral-600">
          Ver historial de pedidos →
        </Link>
      </div>

      {hayHistorial && (
        <div className="px-4 pt-3">
          <button
            onClick={handleRepetirPedido}
            disabled={repitiendo}
            className="w-full rounded-md bg-neutral-800 px-4 py-3 text-base font-medium text-white disabled:opacity-50"
          >
            {repitiendo ? 'Cargando...' : '↻ Repetir último pedido'}
          </button>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-neutral-50 px-4 pb-3 pt-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div className="px-4">
        {categorias.map(([categoria, items]) => (
          <section key={categoria} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-neutral-900">{categoria}</h2>
            <ul className="space-y-2">
              {items.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
                    !p.disponible ? 'opacity-50' : ''
                  }`}
                >
                  {p.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.foto_url} alt="" className="h-14 w-14 rounded-md object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-neutral-100" />
                  )}
                  <div className="min-w-[8rem] flex-1">
                    <p
                      className={`font-medium text-neutral-900 ${
                        !p.disponible ? 'line-through' : ''
                      }`}
                    >
                      {p.nombre}{' '}
                      {p.congelado && <span className="text-xs text-blue-600">❄ congelado</span>}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {p.unidad}
                      {p.precio_sugerido != null && ` · $${p.precio_sugerido}`}
                    </p>
                  </div>
                  {p.disponible ? (
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={cantidadEnCarrito(p.id) || ''}
                      onChange={(e) => actualizarCantidad(p, Number(e.target.value))}
                      placeholder="0"
                      className="w-20 rounded-md border border-neutral-300 px-2 py-2.5 text-center text-base"
                    />
                  ) : (
                    <span className="text-sm text-neutral-400">Agotado</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {categorias.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No encontramos productos.</p>
        )}
      </div>

      {totalItems > 0 && (
        <button
          onClick={() => router.push('/pedido/confirmar')}
          className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between bg-neutral-900 px-4 py-4 text-base font-medium text-white"
        >
          <span>
            🛒 {totalItems} producto(s) · ${totalPrecio.toFixed(2)}
          </span>
          <span>Ver pedido →</span>
        </button>
      )}
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PuntoVenta, Producto } from '@/lib/types'
import {
  calcularTurno,
  obtenerFechaHoyYManana,
  obtenerHoraCorteEfectiva,
  formatearHoraArgentina,
} from '@/lib/comercio/corte'
import { crearPedidoManual } from '../actions'

export function NuevoPedidoForm({
  puntosVenta,
  productos,
  excepciones,
}: {
  puntosVenta: PuntoVenta[]
  productos: Producto[]
  excepciones: Record<string, string>
}) {
  const router = useRouter()
  const [puntoVentaId, setPuntoVentaId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [eleccionFecha, setEleccionFecha] = useState<'hoy' | 'manana'>('hoy')
  const [tipoEtiqueta, setTipoEtiqueta] = useState<'grande' | 'chica' | 'ambas'>('ambas')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function elegirPuntoVenta(id: string) {
    setPuntoVentaId(id)
    const pv = puntosVenta.find((p) => p.id === id)
    if (pv) setTipoEtiqueta(pv.etiqueta_default)
  }

  function actualizarCantidad(productoId: string, cantidad: number) {
    setCantidades((actual) => {
      const copia = { ...actual }
      if (cantidad <= 0) delete copia[productoId]
      else copia[productoId] = cantidad
      return copia
    })
  }

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

  const itemsSeleccionados = Object.entries(cantidades).map(([productoId, cantidad]) => ({
    productoId,
    cantidad,
  }))
  const totalItems = itemsSeleccionados.reduce((acc, i) => acc + i.cantidad, 0)

  const { hoy } = useMemo(() => obtenerFechaHoyYManana(new Date()), [])
  const horaCorteHoy = useMemo(() => obtenerHoraCorteEfectiva(hoy, excepciones), [hoy, excepciones])
  const horaActual = useMemo(() => formatearHoraArgentina(new Date()), [])
  const resultadoSiHoy = useMemo(() => calcularTurno('hoy', new Date(), excepciones), [excepciones])
  const yaCerroHoy = resultadoSiHoy.fechaEntrega !== hoy
  const previewTurno = useMemo(
    () => calcularTurno(eleccionFecha, new Date(), excepciones),
    [eleccionFecha, excepciones]
  )

  async function handleSubmit() {
    setError(null)
    if (!puntoVentaId) {
      setError('Elegí un punto de venta.')
      return
    }
    if (itemsSeleccionados.length === 0) {
      setError('Agregá al menos un producto.')
      return
    }
    setEnviando(true)
    const resultado = await crearPedidoManual({
      puntoVentaId,
      items: itemsSeleccionados,
      eleccionFecha,
      tipoEtiqueta,
    })
    if ('error' in resultado) {
      setError(resultado.error)
      setEnviando(false)
      return
    }
    router.push('/admin/pedidos')
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Cargar pedido manual</h1>
        <button
          onClick={() => router.push('/admin/pedidos')}
          className="text-sm font-medium text-neutral-600"
        >
          ← Volver
        </button>
      </div>
      <p className="text-sm text-neutral-500">
        Para pedidos que llegan por audio de WhatsApp u otro canal fuera de la app. Queda
        guardado igual que un pedido normal, marcado como cargado por admin.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Punto de venta</label>
        <select
          value={puntoVentaId}
          onChange={(e) => elegirPuntoVenta(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        >
          <option value="">Elegí un punto de venta...</option>
          {puntosVenta.map((pv) => (
            <option key={pv.id} value={pv.id}>
              {pv.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="sticky top-0 z-10 bg-background py-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        {categorias.map(([categoria, productosDeCategoria]) => (
          <section key={categoria} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold text-foreground">{categoria}</h2>
            <ul className="space-y-2">
              {productosDeCategoria.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 ${
                    !p.disponible ? 'opacity-50' : ''
                  }`}
                >
                  <div className="min-w-[8rem] flex-1">
                    <p className="font-medium text-foreground">{p.nombre}</p>
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
                      value={cantidades[p.id] || ''}
                      onChange={(e) => actualizarCantidad(p.id, Number(e.target.value))}
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

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Fecha de entrega</p>
        <div className="flex gap-3">
          <button
            onClick={() => setEleccionFecha('hoy')}
            disabled={yaCerroHoy}
            className={`flex-1 rounded-md px-4 py-3 text-base font-medium disabled:opacity-40 ${
              eleccionFecha === 'hoy' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setEleccionFecha('manana')}
            className={`flex-1 rounded-md px-4 py-3 text-base font-medium ${
              eleccionFecha === 'manana' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Mañana
          </button>
        </div>
        {yaCerroHoy && (
          <p className="mt-2 text-sm text-neutral-500">Ya cerramos los pedidos de hoy.</p>
        )}
        {eleccionFecha === 'hoy' ? (
          <p className="mt-2 text-sm text-neutral-600">
            Corte de hoy: {horaCorteHoy} · Hora actual: {horaActual} · Entra en el reparto de la{' '}
            <strong>{previewTurno.turno === 'manana' ? 'MAÑANA' : 'TARDE'}</strong>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-600">
            Entra en el reparto de la <strong>MAÑANA</strong>.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Tipo de etiqueta</label>
        <select
          value={tipoEtiqueta}
          onChange={(e) => setTipoEtiqueta(e.target.value as typeof tipoEtiqueta)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        >
          <option value="grande">Grande sin precio</option>
          <option value="chica">Chica con precio sugerido</option>
          <option value="ambas">Ambas</option>
        </select>
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={enviando}
        className="fixed inset-x-0 bottom-0 z-20 bg-primary px-4 py-4 text-center text-base font-medium text-white disabled:opacity-50"
      >
        {enviando ? 'Guardando...' : `Guardar pedido (${totalItems} producto(s))`}
      </button>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PuntoVenta, ItemCarrito } from '@/lib/types'
import {
  calcularTurno,
  obtenerFechaHoyYManana,
  obtenerHoraCorteEfectiva,
  formatearHoraArgentina,
} from '@/lib/comercio/corte'
import { confirmarPedido } from './actions'
import { CorteBarra } from './CorteBarra'

const CARRITO_KEY = 'don_carmelo_carrito'
const ULTIMO_PEDIDO_KEY = 'don_carmelo_ultimo_pedido'
const AVISO_KEY = 'don_carmelo_aviso'

export function ConfirmarClient({
  puntoVenta,
  excepciones,
}: {
  puntoVenta: PuntoVenta
  excepciones: Record<string, string>
}) {
  const router = useRouter()
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [cargado, setCargado] = useState(false)
  const [eleccionFecha, setEleccionFecha] = useState<'hoy' | 'manana'>('hoy')
  const [tipoEtiqueta, setTipoEtiqueta] = useState(puntoVenta.etiqueta_default)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const guardado = sessionStorage.getItem(CARRITO_KEY)
    if (guardado) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCarrito(JSON.parse(guardado))
      } catch {
        // carrito corrupto, se ignora
      }
    }
    const avisoGuardado = sessionStorage.getItem(AVISO_KEY)
    if (avisoGuardado) {
      setAviso(avisoGuardado)
      sessionStorage.removeItem(AVISO_KEY)
    }
    setCargado(true)
  }, [])

  useEffect(() => {
    if (cargado) sessionStorage.setItem(CARRITO_KEY, JSON.stringify(carrito))
  }, [carrito, cargado])

  function quitarItem(productoId: string) {
    setCarrito((actual) => actual.filter((i) => i.productoId !== productoId))
  }

  function cambiarCantidad(productoId: string, cantidad: number) {
    setCarrito((actual) =>
      cantidad <= 0
        ? actual.filter((i) => i.productoId !== productoId)
        : actual.map((i) => (i.productoId === productoId ? { ...i, cantidad } : i))
    )
  }

  const totalConPrecio = carrito.reduce(
    (acc, i) => acc + (i.precioSugerido != null ? i.precioSugerido * i.cantidad : 0),
    0
  )
  const hayItemsSinPrecio = carrito.some((i) => i.precioSugerido == null)

  const { hoy } = useMemo(() => obtenerFechaHoyYManana(new Date()), [])
  const horaCorteHoy = useMemo(() => obtenerHoraCorteEfectiva(hoy, excepciones), [hoy, excepciones])
  const horaActual = useMemo(() => formatearHoraArgentina(new Date()), [])

  const resultadoSiHoy = useMemo(
    () => calcularTurno('hoy', new Date(), excepciones),
    [excepciones]
  )
  const yaCerroHoy = resultadoSiHoy.fechaEntrega !== hoy

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (yaCerroHoy && eleccionFecha === 'hoy') setEleccionFecha('manana')
  }, [yaCerroHoy, eleccionFecha])

  const previewTurno = useMemo(
    () => calcularTurno(eleccionFecha, new Date(), excepciones),
    [eleccionFecha, excepciones]
  )

  const faltaParaMinimo =
    puntoVenta.pedido_minimo != null ? puntoVenta.pedido_minimo - totalConPrecio : 0
  const llegaAlMinimo =
    puntoVenta.pedido_minimo == null || totalConPrecio >= puntoVenta.pedido_minimo

  async function handleConfirmar() {
    setEnviando(true)
    setError(null)

    const resultado = await confirmarPedido({
      items: carrito.map((i) => ({ productoId: i.productoId, cantidad: i.cantidad })),
      eleccionFecha,
      tipoEtiqueta,
    })

    if ('error' in resultado) {
      setError(resultado.error)
      setEnviando(false)
      return
    }

    sessionStorage.setItem(
      ULTIMO_PEDIDO_KEY,
      JSON.stringify({
        items: carrito,
        fechaEntrega: resultado.fechaEntrega,
        turno: resultado.turno,
        tipoEtiqueta,
      })
    )
    sessionStorage.removeItem(CARRITO_KEY)
    router.push('/pedido/listo')
  }

  if (cargado && carrito.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="mb-4 text-neutral-500">Tu carrito está vacío.</p>
        <button
          onClick={() => router.push('/pedido')}
          className="rounded-md bg-neutral-900 px-4 py-2.5 text-base font-medium text-white"
        >
          Volver al catálogo
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 pb-32">
      <h1 className="text-xl font-semibold text-neutral-900">Confirmar pedido</h1>

      {aviso && <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{aviso}</p>}

      <ul className="space-y-2">
        {carrito.map((item) => (
          <li
            key={item.productoId}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[8rem] flex-1">
              <p className="font-medium text-neutral-900">{item.nombre}</p>
              <p className="text-sm text-neutral-500">
                {item.unidad}
                {item.precioSugerido != null && ` · $${item.precioSugerido}`}
              </p>
            </div>
            <input
              type="number"
              min="0"
              step="0.5"
              value={item.cantidad}
              onChange={(e) => cambiarCantidad(item.productoId, Number(e.target.value))}
              className="w-20 rounded-md border border-neutral-300 px-2 py-2.5 text-center text-base"
            />
            <button
              onClick={() => quitarItem(item.productoId)}
              className="px-2 py-2.5 text-sm font-medium text-red-600"
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Fecha de entrega</p>
        <div className="flex gap-3">
          <button
            onClick={() => setEleccionFecha('hoy')}
            disabled={yaCerroHoy}
            className={`flex-1 rounded-md px-4 py-3 text-base font-medium disabled:opacity-40 ${
              eleccionFecha === 'hoy' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setEleccionFecha('manana')}
            className={`flex-1 rounded-md px-4 py-3 text-base font-medium ${
              eleccionFecha === 'manana' ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Mañana
          </button>
        </div>
        {yaCerroHoy && <p className="mt-2 text-sm text-neutral-500">Ya cerramos los pedidos de hoy.</p>}
        {eleccionFecha === 'hoy' ? (
          <div className="mt-3">
            <CorteBarra horaCorteHoy={horaCorteHoy} horaActual={horaActual} />
            <p className="mt-2 text-sm text-neutral-600">
              Este pedido entra en el reparto de la{' '}
              <strong>{previewTurno.turno === 'manana' ? 'MAÑANA' : 'TARDE'}</strong>.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            Este pedido entra en el reparto de la <strong>MAÑANA</strong>.
          </div>
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

      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <p className="text-lg font-semibold text-neutral-900">Total: ${totalConPrecio.toFixed(2)}</p>
        {hayItemsSinPrecio && (
          <p className="mt-1 text-sm text-neutral-500">
            Algunos productos no tienen precio cargado, no se cuentan en este total.
          </p>
        )}
        {!llegaAlMinimo && (
          <p className="mt-1 text-sm text-red-600">
            El pedido mínimo es ${puntoVenta.pedido_minimo}. Te faltan ${faltaParaMinimo.toFixed(2)}.
          </p>
        )}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        onClick={handleConfirmar}
        disabled={enviando || !llegaAlMinimo}
        className="fixed inset-x-0 bottom-0 z-20 bg-neutral-900 px-4 py-4 text-center text-base font-medium text-white disabled:opacity-50"
      >
        {enviando ? 'Confirmando...' : 'Confirmar pedido'}
      </button>
    </div>
  )
}

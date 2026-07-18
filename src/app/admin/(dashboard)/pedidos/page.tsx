import Link from 'next/link'
import { obtenerFechaHoyYManana } from '@/lib/comercio/corte'
import { obtenerPedidosDelDia, calcularCantidadesAtipicas } from '@/lib/admin/pedidos'
import { TurnoSection } from './TurnoSection'

function sumarDias(fechaYYYYMMDD: string, dias: number): string {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>
}) {
  const { fecha: fechaParam } = await searchParams
  const fecha = fechaParam ?? obtenerFechaHoyYManana(new Date()).hoy

  const pedidos = await obtenerPedidosDelDia(fecha)
  const pedidosManana = pedidos.filter((p) => p.turno_reparto === 'manana')
  const pedidosTarde = pedidos.filter((p) => p.turno_reparto === 'tarde')
  const atipicos = await calcularCantidadesAtipicas(pedidos)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-900">Pedidos</h1>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, -1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            ← Anterior
          </Link>
          <span className="text-base font-medium text-neutral-900">{fecha}</span>
          <Link
            href={`/admin/pedidos?fecha=${sumarDias(fecha, 1)}`}
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Siguiente →
          </Link>
        </div>
      </div>

      <TurnoSection titulo="Turno mañana" fecha={fecha} turno="manana" pedidos={pedidosManana} atipicos={atipicos} />
      <TurnoSection titulo="Turno tarde" fecha={fecha} turno="tarde" pedidos={pedidosTarde} atipicos={atipicos} />
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { obtenerHistorialPedidos } from '@/lib/comercio/pedidos'

const ETIQUETA_LABEL: Record<'grande' | 'chica' | 'ambas', string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export const dynamic = 'force-dynamic'

export default async function HistorialPage() {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) redirect('/')

  const pedidos = await obtenerHistorialPedidos(puntoVentaId)

  return (
    <div className="p-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Historial de pedidos</h1>
        <Link href="/pedido" className="text-sm font-medium text-neutral-600">
          ← Volver al catálogo
        </Link>
      </div>

      {pedidos.length === 0 && (
        <p className="py-8 text-center text-neutral-500">Todavía no hiciste ningún pedido.</p>
      )}

      <ul className="space-y-2">
        {pedidos.map((pedido) => {
          const nombres = pedido.pedido_items
            .map((item) => item.productos?.nombre)
            .filter((nombre): nombre is string => Boolean(nombre))
          const resumen =
            nombres.length <= 3
              ? nombres.join(', ')
              : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`

          return (
            <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{pedido.fecha_entrega}</p>
                <span className="text-sm text-neutral-500">
                  {pedido.turno_reparto === 'manana' ? 'Mañana' : 'Tarde'} · {pedido.estado}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {pedido.pedido_items.length} producto(s): {resumen}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Etiqueta: {ETIQUETA_LABEL[pedido.tipo_etiqueta]}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

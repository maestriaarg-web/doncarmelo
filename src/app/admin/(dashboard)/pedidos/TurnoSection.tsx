import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion, type ItemPreparacion } from '@/lib/admin/pedidos'
import { EstadoPedidoAcciones } from './EstadoPedidoAcciones'

const SIN_ZONA = 'Sin zona'

function agruparPorCategoria(items: ItemPreparacion[]): [string, ItemPreparacion[]][] {
  const mapa = new Map<string, ItemPreparacion[]>()
  for (const item of items) {
    const lista = mapa.get(item.categoria) ?? []
    lista.push(item)
    mapa.set(item.categoria, lista)
  }
  return Array.from(mapa.entries())
}

function agruparPedidosPorZona(pedidos: PedidoAdmin[]): [string, PedidoAdmin[]][] {
  const mapa = new Map<string, PedidoAdmin[]>()
  for (const pedido of pedidos) {
    const zona = pedido.puntos_venta?.zona || SIN_ZONA
    const lista = mapa.get(zona) ?? []
    lista.push(pedido)
    mapa.set(zona, lista)
  }
  return Array.from(mapa.entries()).sort(([a], [b]) => {
    if (a === SIN_ZONA) return 1
    if (b === SIN_ZONA) return -1
    return a.localeCompare(b)
  })
}

export function TurnoSection({
  titulo,
  fecha,
  turno,
  pedidos,
  atipicos,
}: {
  titulo: string
  fecha: string
  turno: 'manana' | 'tarde'
  pedidos: PedidoAdmin[]
  atipicos: Set<string>
}) {
  const preparacion = consolidarPreparacion(pedidos)
  const preparacionPorCategoria = agruparPorCategoria(preparacion)
  const pedidosPorZona = agruparPedidosPorZona(pedidos)

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        {pedidos.length > 0 && (
          <a
            href={`/admin/remitos?fecha=${fecha}&turno=${turno}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Imprimir todos los remitos
          </a>
        )}
      </div>

      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Lista de preparación consolidada
            </h3>
            <div className="space-y-3 text-sm">
              {preparacionPorCategoria.map(([categoria, items]) => (
                <div key={categoria}>
                  <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
                    {categoria}
                  </p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.productoId} className="flex justify-between">
                        <span>{item.nombre}</span>
                        <span className="text-neutral-500">
                          {item.cantidadTotal} {item.unidad} ({item.cantidadPedidos} pedido(s))
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {pedidosPorZona.map(([zona, pedidosDeZona]) => (
              <div key={zona}>
                <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-400">{zona}</h3>
                <ul className="space-y-2">
                  {pedidosDeZona.map((pedido) => (
                    <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">
                          {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
                        </p>
                        <a
                          href={`/admin/remito/${pedido.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                        >
                          Imprimir remito
                        </a>
                      </div>
                      {pedido.fuera_de_horario && (
                        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          ⚠ Fuera de horario
                        </span>
                      )}
                      <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                        {pedido.pedido_items.map((item) => {
                          const esAtipico = atipicos.has(`${pedido.id}:${item.producto_id}`)
                          return (
                            <li key={item.id} className={esAtipico ? 'font-medium text-amber-800' : ''}>
                              {item.cantidad} {item.productos?.unidad ?? ''} —{' '}
                              {item.productos?.nombre ?? 'Producto'}
                              {esAtipico && <span className="ml-2 text-xs">⚠ Cantidad atípica</span>}
                            </li>
                          )
                        })}
                      </ul>
                      <EstadoPedidoAcciones pedidoId={pedido.id} estado={pedido.estado} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

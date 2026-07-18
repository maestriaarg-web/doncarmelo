import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion } from '@/lib/admin/pedidos'

export function TurnoSection({
  titulo,
  pedidos,
  atipicos,
}: {
  titulo: string
  pedidos: PedidoAdmin[]
  atipicos: Set<string>
}) {
  const preparacion = consolidarPreparacion(pedidos)

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{titulo}</h2>
      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Lista de preparación consolidada
            </h3>
            <ul className="space-y-1 text-sm">
              {preparacion.map((item) => (
                <li key={item.productoId} className="flex justify-between">
                  <span>{item.nombre}</span>
                  <span className="text-neutral-500">
                    {item.cantidadTotal} {item.unidad} ({item.cantidadPedidos} pedido(s))
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <ul className="space-y-2">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <p className="font-medium text-neutral-900">
                  {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
                </p>
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
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

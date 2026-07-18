import type { PedidoAdmin } from '@/lib/types'

export function TurnoSection({
  titulo,
  pedidos,
}: {
  titulo: string
  pedidos: PedidoAdmin[]
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-neutral-900">{titulo}</h2>
      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <ul className="space-y-2">
          {pedidos.map((pedido) => (
            <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <p className="font-medium text-neutral-900">
                {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
              </p>
              <p className="text-sm text-neutral-500">
                {pedido.pedido_items.length} producto(s)
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

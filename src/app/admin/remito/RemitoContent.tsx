import type { PedidoAdmin } from '@/lib/types'

const ETIQUETA_LABEL: Record<PedidoAdmin['tipo_etiqueta'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function RemitoContent({ pedido }: { pedido: PedidoAdmin }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-foreground">
        {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
      </h2>
      {pedido.puntos_venta?.direccion && (
        <p className="text-sm text-neutral-600">{pedido.puntos_venta.direccion}</p>
      )}
      {pedido.puntos_venta?.zona && (
        <p className="text-sm text-neutral-600">Zona: {pedido.puntos_venta.zona}</p>
      )}
      <p className="mt-2 text-sm text-foreground">
        Fecha de entrega: <strong>{pedido.fecha_entrega}</strong> · Turno:{' '}
        <strong>{pedido.turno_reparto === 'manana' ? 'Mañana' : 'Tarde'}</strong>
      </p>
      <p className="text-sm text-foreground">
        Etiqueta: <strong>{ETIQUETA_LABEL[pedido.tipo_etiqueta]}</strong>
      </p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-1">Producto</th>
            <th className="py-1 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {pedido.pedido_items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-100">
              <td className="py-1">{item.productos?.nombre ?? 'Producto'}</td>
              <td className="py-1 text-right">
                {item.cantidad} {item.productos?.unidad ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { obtenerPedidosDelDia } from '@/lib/admin/pedidos'
import { RemitoContent } from '../remito/RemitoContent'
import { AutoPrint } from '../remito/AutoPrint'

export default async function RemitosDelTurnoPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; turno?: string }>
}) {
  const { fecha, turno } = await searchParams

  if (!fecha || (turno !== 'manana' && turno !== 'tarde')) {
    return <p className="p-6 text-neutral-500">Falta la fecha o el turno.</p>
  }

  const pedidos = await obtenerPedidosDelDia(fecha)
  const delTurno = pedidos.filter((p) => p.turno_reparto === turno)

  return (
    <div className="bg-white">
      {delTurno.map((pedido, index) => (
        <div
          key={pedido.id}
          className={index < delTurno.length - 1 ? 'break-after-page' : undefined}
        >
          <RemitoContent pedido={pedido} />
        </div>
      ))}
      {delTurno.length === 0 && (
        <p className="p-6 text-neutral-500">Sin pedidos para imprimir.</p>
      )}
      <AutoPrint />
    </div>
  )
}

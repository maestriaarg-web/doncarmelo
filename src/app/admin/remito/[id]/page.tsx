import { notFound } from 'next/navigation'
import { obtenerPedidoPorId } from '@/lib/admin/pedidos'
import { RemitoContent } from '../RemitoContent'
import { AutoPrint } from '../AutoPrint'

export default async function RemitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pedido = await obtenerPedidoPorId(id)
  if (!pedido) notFound()

  return (
    <div className="bg-white">
      <RemitoContent pedido={pedido} />
      <AutoPrint />
    </div>
  )
}

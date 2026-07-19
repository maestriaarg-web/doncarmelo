// src/app/api/backup-semanal/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/service'
import { generarBackupExcel } from '@/lib/backup/generarExcel'
import type {
  PuntoVentaBackupRow,
  ProductoBackupRow,
  PedidoBackupRow,
} from '@/lib/backup/generarExcel'

type PedidoConsulta = {
  fecha_entrega: string
  turno_reparto: string
  estado: string
  puntos_venta: { nombre: string } | null
  pedido_items: {
    cantidad: number
    productos: { nombre: string; unidad: string } | null
  }[]
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // Fail closed: sin CRON_SECRET configurado, "Bearer undefined" sería un
    // valor adivinable que pasaría la comparación de abajo.
    console.error('backup-semanal: falta CRON_SECRET en las variables de entorno')
    return NextResponse.json({ error: 'Configuración incompleta.' }, { status: 500 })
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()

    const { data: configuracion, error: errorConfig } = await supabase
      .from('configuracion')
      .select('backup_email')
      .eq('id', 1)
      .single()

    if (errorConfig) {
      console.error('backup-semanal: no se pudo leer la configuración', errorConfig)
      return NextResponse.json({ error: errorConfig.message }, { status: 500 })
    }

    if (!configuracion?.backup_email) {
      return NextResponse.json({ skipped: true, reason: 'Sin backup_email configurado' })
    }

    const { data: puntosVentaData, error: errorPV } = await supabase
      .from('puntos_venta')
      .select('nombre, celular, direccion, zona, contacto, etiqueta_default, pedido_minimo, activo')

    if (errorPV) {
      console.error('backup-semanal: error trayendo puntos_venta', errorPV)
      return NextResponse.json({ error: errorPV.message }, { status: 500 })
    }

    const { data: productosData, error: errorProductos } = await supabase
      .from('productos')
      .select('nombre, categoria, unidad, precio_sugerido, congelado, disponible, activo')

    if (errorProductos) {
      console.error('backup-semanal: error trayendo productos', errorProductos)
      return NextResponse.json({ error: errorProductos.message }, { status: 500 })
    }

    const haceSieteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: pedidosData, error: errorPedidos } = await supabase
      .from('pedidos')
      .select(
        'fecha_entrega, turno_reparto, estado, creado_en, puntos_venta(nombre), pedido_items(cantidad, productos(nombre, unidad))'
      )
      .gte('creado_en', haceSieteDias)

    if (errorPedidos) {
      console.error('backup-semanal: error trayendo pedidos', errorPedidos)
      return NextResponse.json({ error: errorPedidos.message }, { status: 500 })
    }

    const pedidosFilas: PedidoBackupRow[] = ((pedidosData ?? []) as unknown as PedidoConsulta[]).flatMap(
      (pedido) =>
        pedido.pedido_items.map((item) => ({
          fecha_entrega: pedido.fecha_entrega,
          turno_reparto: pedido.turno_reparto,
          punto_venta: pedido.puntos_venta?.nombre ?? 'Punto de venta',
          estado: pedido.estado,
          producto: item.productos?.nombre ?? 'Producto',
          unidad: item.productos?.unidad ?? '',
          cantidad: item.cantidad,
        }))
    )

    const buffer = await generarBackupExcel({
      puntosVenta: (puntosVentaData ?? []) as PuntoVentaBackupRow[],
      productos: (productosData ?? []) as ProductoBackupRow[],
      pedidos: pedidosFilas,
    })

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fecha = new Date().toISOString().slice(0, 10)
    const { error: errorEnvio } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: configuracion.backup_email,
      subject: `Backup semanal Don Carmelo — ${fecha}`,
      text: 'Adjunto el backup semanal de puntos de venta, productos y pedidos de los últimos 7 días.',
      attachments: [{ filename: `backup-doncarmelo-${fecha}.xlsx`, content: buffer }],
    })

    if (errorEnvio) {
      console.error('backup-semanal: error mandando el mail', errorEnvio)
      return NextResponse.json({ error: errorEnvio.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('backup-semanal: error inesperado', err)
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 })
  }
}

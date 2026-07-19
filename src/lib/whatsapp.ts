import { createServiceClient } from '@/lib/supabase/service'

type EstadoPedido = 'confirmado' | 'preparado' | 'entregado' | 'cancelado'

const MENSAJE_POR_ESTADO: Record<EstadoPedido, (fecha: string, turno: string) => string> = {
  confirmado: (fecha, turno) =>
    `Hola! Tu pedido para el ${fecha} (turno ${turno}) fue confirmado. Te avisamos cuando esté listo.`,
  preparado: (fecha, turno) => `Tu pedido para el ${fecha} (turno ${turno}) ya está preparado.`,
  entregado: (fecha, turno) =>
    `Tu pedido para el ${fecha} (turno ${turno}) fue entregado. ¡Gracias por tu compra!`,
  cancelado: (fecha, turno) => `Tu pedido para el ${fecha} (turno ${turno}) fue cancelado.`,
}

async function enviarWhatsApp(numero: string, mensaje: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from) {
    console.error('enviarWhatsApp: faltan TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM')
    return
  }

  try {
    const credenciales = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    const respuesta = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credenciales}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: `whatsapp:${numero}`,
          From: from,
          Body: mensaje,
        }),
      }
    )

    if (!respuesta.ok) {
      const texto = await respuesta.text()
      console.error('enviarWhatsApp: Twilio respondió con error', respuesta.status, texto)
    }
  } catch (err) {
    console.error('enviarWhatsApp: error de red al llamar a Twilio', err)
  }
}

/**
 * Busca fecha/turno/celular del pedido, arma el mensaje según el estado, y
 * dispara el envío. Nunca lanza — un fallo acá no debe romper el flujo real
 * (confirmar/marcar/cancelar un pedido) que la llamó.
 */
export async function notificarEstadoPedido(pedidoId: string, estado: EstadoPedido): Promise<void> {
  try {
    // createServiceClient() puede tirar de forma sincrónica (ej. si falta una
    // variable de entorno de Supabase) — con la función async, eso se
    // convierte en una promesa rechazada. Todo el cuerpo va dentro del mismo
    // try para que ese caso también quede cubierto por el "nunca lanza".
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('pedidos')
      .select('fecha_entrega, turno_reparto, puntos_venta(celular)')
      .eq('id', pedidoId)
      .maybeSingle()

    if (error || !data) {
      console.error('notificarEstadoPedido: no se pudo encontrar el pedido', pedidoId, error)
      return
    }

    const pedido = data as unknown as {
      fecha_entrega: string
      turno_reparto: 'manana' | 'tarde'
      puntos_venta: { celular: string } | null
    }

    const celular = pedido.puntos_venta?.celular
    if (!celular) {
      console.error('notificarEstadoPedido: el punto de venta no tiene celular cargado', pedidoId)
      return
    }

    const turnoLabel = pedido.turno_reparto === 'manana' ? 'mañana' : 'tarde'
    const mensaje = MENSAJE_POR_ESTADO[estado](pedido.fecha_entrega, turnoLabel)
    const numero = `+549${celular}`

    await enviarWhatsApp(numero, mensaje)
  } catch (err) {
    console.error('notificarEstadoPedido: error inesperado', pedidoId, err)
  }
}

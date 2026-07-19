# Integración WhatsApp

**Fecha:** 2026-07-18
**Sub-proyecto:** 3 de 4 de Fase 2 (orden: conciliación, roles, WhatsApp, zonas de reparto)
**Sub-proyecto anterior:** [Roles de usuario](2026-07-18-roles-usuario-design.md) (completo, en producción).

## Contexto

Los comercios hoy solo se enteran del estado de su pedido entrando a `/pedido/historial`. El objetivo de este sub-proyecto es avisarles automáticamente por WhatsApp en cada cambio de estado del pedido — los mismos 4 estados que ya introdujo la conciliación de pedidos (confirmado, preparado, entregado, cancelado).

No hay infraestructura de mensajería en el proyecto (Resend para email quedó sin usar en Fase 1 original). Se usa **Twilio** como proveedor, en modo **sandbox** para este sub-proyecto — el usuario se encarga de la verificación de WhatsApp Business con Meta para pasar a producción real más adelante; el código no necesita cambios para esa migración, solo la configuración del lado de Twilio.

## Alcance

**Incluye:**
- `src/lib/whatsapp.ts`: `enviarWhatsApp(numero, mensaje)` (llamada REST directa a la API de Twilio, sin agregar el SDK como dependencia) y `notificarEstadoPedido(pedidoId, estado)` (arma el mensaje y el número de destino, y llama a `enviarWhatsApp`).
- El número de WhatsApp se arma como `whatsapp:+549<celular>`, donde `<celular>` es el valor ya guardado en `puntos_venta.celular` (10 dígitos, código de área + número, sin `+54` — confirmado con el usuario que todos los comercios son de Argentina en ese mismo formato).
- Se engancha una llamada a `notificarEstadoPedido` en los 4 puntos donde ya cambia `pedidos.estado`: `confirmarPedido` (comercio), `marcarPreparado`, `marcarEntregado`, `cancelarPedido` (admin).
- Envío best-effort: cualquier error de Twilio (número no unido al sandbox, credenciales, rate limit, etc.) se loggea con `console.error` y nunca hace fallar la acción que lo llamó — confirmar/marcar/cancelar un pedido sigue funcionando aunque el WhatsApp no salga.
- Variables de entorno nuevas: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (ej. `whatsapp:+14155238886` para el sandbox).

**Fuera de alcance:**
- Verificación de WhatsApp Business con Meta / salida del modo sandbox — proceso externo que hace el usuario a su ritmo, no es parte de este plan.
- Plantillas de mensaje aprobadas por Meta (necesarias eventualmente para notificaciones fuera de la ventana de 24hs una vez en producción real) — el sandbox no las requiere, así que quedan fuera de este sub-proyecto; sería un ajuste menor a futuro si hace falta.
- Mensajes entrantes / responder desde WhatsApp — solo envío saliente.
- Reintentos automáticos si un envío falla — un fallo simplemente se loggea, sin cola de reintentos.
- Cualquier otro ítem de Fase 2 (zonas de reparto).

## Mensajes por estado

```ts
const MENSAJE_POR_ESTADO: Record<EstadoPedido, (fechaEntrega: string, turno: string) => string> = {
  confirmado: (fecha, turno) => `Hola! Tu pedido para el ${fecha} (turno ${turno}) fue confirmado. Te avisamos cuando esté listo.`,
  preparado: (fecha, turno) => `Tu pedido para el ${fecha} (turno ${turno}) ya está preparado.`,
  entregado: (fecha, turno) => `Tu pedido para el ${fecha} (turno ${turno}) fue entregado. ¡Gracias por tu compra!`,
  cancelado: (fecha, turno) => `Tu pedido para el ${fecha} (turno ${turno}) fue cancelado.`,
}
```

(Redacción exacta se ajusta al escribir el plan si hace falta, pero la estructura — fecha + turno + estado — queda fija.)

## `notificarEstadoPedido`

Usa el service-role client (necesita funcionar tanto desde el lado comercio como desde el admin, y ambos ya tienen acceso de lectura a `puntos_venta`/`pedidos` de una forma u otra — usar siempre el service-role client acá mantiene el módulo autocontenido sin depender del contexto del que lo llama). Busca `fecha_entrega`, `turno_reparto`, y `puntos_venta.celular` para el `pedidoId` dado, arma el mensaje, arma el número, y llama a `enviarWhatsApp`. Si el pedido o el celular no se encuentran, loggea y no hace nada (mismo principio best-effort).

## Testing

Sin suite automatizada (decisión ya confirmada para todo el proyecto). Verificación por `npm run build` + `npm run lint` + prueba manual: con el celular del usuario unido al sandbox de Twilio, confirmar un pedido de prueba y verificar que llega el WhatsApp de "confirmado"; marcarlo preparado y entregado desde el admin viendo llegar cada mensaje; cancelar otro pedido y confirmar el mensaje de cancelado. Confirmar también que si las credenciales de Twilio faltan o son inválidas, el flujo de confirmar/marcar/cancelar pedidos sigue funcionando normalmente (solo falla el envío, no la acción).

# Manuales de usuario (comercio y admin)

**Fecha:** 2026-07-19
**Contexto de origen:** el sistema está terminado (Fase 1, Fase 2, backup semanal). El usuario pidió un tutorial para entregar junto con el producto final, dirigido tanto a los comercios que hacen pedidos como a Don Carmelo/su personal que administra el sistema.

## Contexto

Hoy nadie tiene documentación de cómo usar la app — ni los comercios (acceso por celular, catálogo, carrito) ni Don Carmelo (todas las pantallas del panel admin). El objetivo es dejar dos manuales en PDF, con capturas de pantalla reales, que alguien sin conocimientos técnicos pueda seguir paso a paso para usar el sistema sin ayuda externa.

## Alcance

**Incluye:**
- `Manual del comercio.pdf`: ingresar con el celular, catálogo y búsqueda, armar el carrito, elegir etiqueta, confirmar el pedido (con explicación del corte de horario mañana/tarde y qué pasa si el pedido queda "fuera de horario"), pantalla de confirmación final, historial de pedidos, repetir el último pedido, productos frecuentes.
- `Manual del administrador.pdf`: login, pantalla de pedidos del día (lista de preparación consolidada, badges de fuera de horario y cantidad atípica, agrupamiento por zona, botones de estado confirmado→preparado→entregado y cancelar), imprimir remitos (individual y por turno), ABM de productos, ABM de puntos de venta (incluida la zona de reparto), excepciones de corte, gestión de usuarios y roles (admin/empleado), configuración del email de backup semanal, y una explicación breve (sin pantallas propias, ya que es automático) de cómo y cuándo le llegan los avisos por WhatsApp a los comercios.
- Un punto de venta de demostración ("Comercio de Ejemplo") con 2-3 pedidos de ejemplo, creado solo para tener datos limpios y no sensibles en las capturas — se usa el catálogo de productos real (no es información sensible, es el menú del negocio), pero ningún dato de un comercio real aparece en ningún manual.
- Cada paso combina una captura de pantalla real con 2-4 líneas de texto en español explicando qué hacer.

**Fuera de alcance:**
- Video tutorial o página de ayuda dentro de la app (se evaluó y se descartó a favor de PDF).
- Documentación técnica para desarrolladores (arquitectura, cómo correr el proyecto local, etc.) — estos manuales son para usuarios finales, no para quien mantenga el código.
- Traducción a otros idiomas.
- Capturas de pantalla en modo oscuro o de tamaños de pantalla distintos a desktop/mobile estándar (se captura en el tamaño más representativo de cómo cada audiencia realmente usa el sistema: mobile para el comercio, desktop para el admin).

## Cómo se implementa

- **Datos de demostración**: se crea un punto de venta "Comercio de Ejemplo" (celular ficticio con formato válido, zona "Centro", etiqueta "ambas", pedido mínimo cargado) directo en producción, y 2-3 pedidos de ejemplo con estados distintos (uno confirmado, uno preparado, uno entregado) para que las capturas del admin muestren el flujo completo de estados y el remito con contenido real. Se borran (punto de venta y pedidos) al terminar de sacar todas las capturas, dejando la base de producción como estaba.
- **Capturas**: se usa el navegador para recorrer cada pantalla en producción (`https://doncarmelo.vercel.app`) — mobile viewport para el flujo `/pedido/*`, desktop para `/admin/*` — y se guardan como imágenes en `docs/superpowers/assets/manuales/`.
- **Redacción**: un archivo Markdown por manual (`docs/superpowers/assets/manuales/manual-comercio.md`, `manual-admin.md`) con las capturas embebidas y el texto explicativo en español, en el mismo tono llano que el resto de la copy de la app.
- **Conversión a PDF**: cada Markdown se convierte a PDF y se deja en `docs/manuales/Manual del comercio.pdf` y `docs/manuales/Manual del administrador.pdf`.

## Testing

No aplica un "testing" en el sentido de código — la verificación es una lectura completa de ambos PDFs por el usuario antes de darlos por terminados, confirmando que las capturas coinciden con la app actual y que los pasos se pueden seguir sin ambigüedad.

# Pase de diseño UI/UX

**Fecha:** 2026-07-18
**Sub-proyecto:** 1 de 1 (pase visual, no forma parte de la numeración de Fase 1/Fase 2 del brief original — es una mejora transversal solicitada después de cerrar Fase 1)
**Sub-proyecto anterior:** [Gestión de pedidos (admin)](2026-07-18-gestion-pedidos-admin-design.md) — cierra Fase 1, completo y en producción.

## Contexto

Hasta ahora, tanto la app cliente (comercio) como el panel admin usaron un diseño deliberadamente neutro — Tailwind sin paleta ni tipografía propia, literalmente el scaffold por defecto de `create-next-app` (`globals.css` define variables `--background`/`--foreground` que nadie usa realmente, y el `body` fuerza `font-family: Arial, Helvetica, sans-serif`, ignorando la fuente `Geist` que ya está instalada vía `next/font`). Fue una decisión consciente: priorizar el flujo funcional durante Fase 1 y no asumir una identidad de marca sin confirmarla con el usuario.

Con Fase 1 completa, el usuario pidió arrancar este pase. Durante el brainstorming (con el compañero visual del navegador) surgió que Almacén Don Carmelo **sí tiene una identidad de marca real y consistente**, visible en su cuenta de Instagram (@almacendoncarmelo): un isotipo circular en línea de color rojo (usado en foto de perfil y en los 5 destacados de historias), y esa misma familia de rojo repetida en piezas de marketing ("PROMO", "COSTILLA TERNERA", "$22.500") junto con negro y blanco. El usuario compartió tanto capturas de Instagram como el archivo del isotipo en sí.

## Alcance

**Incluye:**
- Sistema de diseño (tokens de color y tipografía) definido en `src/app/globals.css`, reemplazando el scaffold por defecto.
- Aplicación de esos tokens sobre **todas las pantallas existentes** de ambas superficies — sin excepciones, para que no quede una mezcla de estilos viejo/nuevo:
  - **App cliente:** acceso por celular, catálogo (`/pedido`), confirmar pedido (`/pedido/confirmar`), confirmación final (`/pedido/listo`), historial (`/pedido/historial`).
  - **Panel admin:** login (`/admin/login`), nav/header del dashboard, pedidos (`/admin/pedidos`), productos, puntos de venta, excepciones de corte, y las vistas de remito imprimible (`/admin/remito/[id]`, `/admin/remitos`).
- Isotipo real de la marca (círculo rojo en línea) integrado como favicon del sitio y acompañando el wordmark "Don Carmelo" en los headers de ambas apps.
- Corrección del bug de scaffold: activar la fuente `Geist` ya instalada en vez del `Arial` hardcodeado.

**Fuera de alcance (explícitamente, para no mezclar este pase con trabajo funcional):**
- Cualquier cambio de flujo, lógica de negocio, estructura de páginas, o navegación. Es un pase puramente visual sobre lo que ya funciona.
- Cualquier ítem de Fase 2 del brief original (WhatsApp, roles, conciliación, zonas de reparto).
- Contenido nuevo derivado del perfil de Instagram (dirección, WhatsApp, tagline "carne orgánica de pastizales naturales") — quedó como observación durante el brainstorming pero no se agrega a la app en este pase; si el usuario lo quiere, es un pedido aparte.

## Sistema de diseño

**Color:**
- **Rojo primario** — acento de marca: precios destacados, botones de acción principal (confirmar pedido, guardar), badges de "PROMO"/atípico/fuera de horario se mantienen en ámbar como están (no compiten con el rojo de marca). Valor exacto pendiente de muestreo del archivo real del isotipo (ver Tarea 1 del plan de implementación) — aproximación de trabajo: `#E42313`.
- **Negro casi puro** (`#161616`) — texto principal, header del panel admin.
- **Blanco / gris muy claro** (`#FAFAFA` para fondos de sección, blanco puro para tarjetas) — fondos.
- **Gris medio** (`#777777`) — texto secundario (unidades, metadatos).
- Se descartan las direcciones "artesanal" (bordó/cuero) y "moderno con verde" evaluadas durante el brainstorming — el usuario confirmó la real: rojo/negro/blanco.

**Tipografía:**
- Sans-serif del sistema vía la fuente `Geist` (`next/font`), ya instalada — se corrige el `body { font-family: Arial... }` de `globals.css` que hoy la pisa.
- Sin serif en ningún lado.

**Bordes y espaciado:**
- Se mantienen los radios y espaciados actuales de Tailwind (`rounded-md`/`rounded-lg`, `p-3`/`p-4`, etc.) — ya son razonables, este pase no los toca.

**Logo:**
- Isotipo circular real (archivo provisto por el usuario) + wordmark de texto "Don Carmelo" en la tipografía del sistema, usados juntos en el header de ambas apps y el isotipo solo como favicon.
- El archivo real debe incorporarse al proyecto (ej. `public/logo.svg` o `.png`) antes de poder tomar el color exacto — es la primera tarea del plan de implementación, no se aproxima el color a ojo desde una captura.

## Cómo se implementa

Los tokens de color/tipografía se definen una sola vez en `src/app/globals.css` usando el bloque `@theme` de Tailwind v4 (ya existe la estructura, hoy vacía de contenido real). A partir de ahí, cada pantalla se retoca reemplazando las clases `neutral-*`/`bg-neutral-900`/etc. hardcodeadas por las nuevas clases semánticas del tema, pantalla por pantalla — no es una reescritura, es un reemplazo de clases sobre la estructura JSX existente.

Orden sugerido (de más impacto/visibilidad a menos, y agrupando por archivo para que cada tarea del plan sea autocontenida):
1. Tokens base + favicon + fix de tipografía (una sola vez, en `globals.css` y `layout.tsx`).
2. App cliente: catálogo, confirmar, listo, historial (son las pantallas que ve el comercio a diario).
3. Panel admin: nav/header, login, pedidos (incluye remitos), productos, puntos de venta, excepciones.

## Testing

Sin suite automatizada (decisión ya confirmada para todo el proyecto). Verificación por `npm run build` + `npm run lint` + revisión visual manual en el navegador contra el dev server, pantalla por pantalla — mobile-first para la app cliente (así la usan los comercios), desktop para el panel admin. No hace falta probar contra Supabase real ya que no cambia ningún dato ni lógica — alcanza con datos ya cargados de sub-proyectos anteriores.

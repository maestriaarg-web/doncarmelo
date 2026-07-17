# App cliente — catálogo, carrito y corte automático

**Fecha:** 2026-07-17
**Sub-proyecto:** 2 de N (ver roadmap en el brief de proyecto — Fase 1: app cliente, panel admin)
**Sub-proyecto anterior:** [Setup + ABM admin](2026-07-17-setup-y-abm-admin-design.md) (completo, en producción)
**Siguiente sub-proyecto:** Historial de pedidos + "repetir último pedido" + productos frecuentes + countdown visual

## Contexto

Con el panel admin funcionando (ABM de productos y puntos de venta ya en producción), este sub-proyecto construye la parte que van a usar los comercios: el flujo completo de armar y confirmar un pedido, reemplazando el Google Form de 5 páginas.

Es el corazón del sistema. La regla de negocio más importante — el corte de las 9am que decide si un pedido entra en el reparto de la mañana o de la tarde — se implementa acá, calculada automáticamente en el servidor, nunca elegida por el usuario.

## Alcance de este sub-proyecto

**Incluye:**
- Acceso por número de celular (sin usuario/contraseña, sin verificación por SMS), persistente en el dispositivo.
- Catálogo de productos agrupado por categoría, con foto, indicador de congelado, disponibilidad, y buscador.
- Carrito con cantidades, editable.
- Selección de fecha de entrega (hoy / mañana) con cálculo automático del turno de reparto.
- Selección de tipo de etiqueta (default del punto de venta, editable).
- Validación de pedido mínimo.
- Confirmación de pedido grande y clara.

**Explícitamente fuera de alcance** (confirmado con el usuario, van al próximo sub-proyecto):
- Historial de pedidos propios.
- Botón "Repetir último pedido".
- Sección "mis productos frecuentes" (depende de tener historial real).
- Countdown visual animado del corte (acá solo se muestra el turno calculado como texto).

No se modifica el modelo de datos — `pedidos` y `pedido_items` ya existen desde la migración del sub-proyecto anterior.

## Arquitectura de rutas

Todo fuera de `/admin`, en el mismo proyecto Next.js:

- **`/`** — si no hay cookie de sesión de comercio válida, muestra el formulario para ingresar el celular. Si ya hay cookie válida, redirige a `/pedido`.
- **`/pedido`** — catálogo con buscador y carrito (pantalla principal).
- **`/pedido/confirmar`** — resumen del carrito, fecha, turno calculado, tipo de etiqueta, botón de confirmación.
- **`/pedido/listo`** — pantalla de confirmación final.

## Acceso del comercio

- El comercio ingresa su **celular** en `/`. Un Route Handler lo normaliza (deja solo dígitos, igual que hace el admin al guardarlo) y lo valida server-side contra `puntos_venta.celular` (`activo = true`).
- Si es válido: se setea una **cookie httpOnly, sin expiración corta** (persistente en el dispositivo, según lo definido en el sub-proyecto anterior), con el `punto_venta_id`. Redirige a `/pedido`.
- Si es inválido: mensaje de error en la misma pantalla, reintentar.
- Todas las rutas bajo `/pedido/*` verifican esta cookie server-side (vía un helper, similar al middleware de `/admin` pero sin Supabase Auth) y redirigen a `/` si no es válida.
- Todas las queries del comercio (leer catálogo, crear pedido) se hacen server-side con la service role key — el comercio nunca tiene acceso directo a Supabase desde el browser.

## Lógica del corte automático (el núcleo del sub-proyecto)

Calculada en el servidor al confirmar el pedido, nunca elegida por el usuario:

```
hora_corte = excepciones_corte[fecha_entrega]?.hora_corte ?? '09:00'
hora_cierre_tarde = '20:00'  -- fin del reparto de la tarde

si fecha_entrega == hoy:
    si hora_actual < hora_corte:
        turno = 'manana'
    si no si hora_actual < hora_cierre_tarde:
        turno = 'tarde'
    si no:
        -- ya cerró todo reparto de hoy: no se deja confirmar para "hoy"
        -- se le avisa al comercio y se lo empuja a elegir "mañana"
        fecha_entrega se fuerza a mañana, turno = 'manana'
si fecha_entrega == mañana:
    turno = 'manana'  -- ese día todavía no llegó a su propio corte de las 9am
```

- `excepciones_corte` ya existe en el modelo de datos (creada en el sub-proyecto anterior); la lógica la consulta pero la pantalla de admin para cargar excepciones no es parte de este sub-proyecto.
- `fuera_de_horario` en la tabla `pedidos` se marca `true` únicamente cuando el pedido se confirma después del `hora_corte` para ese `fecha_entrega` (es decir, terminó en el turno de la tarde por haberse pasado del corte de la mañana) — sirve para el aviso visual en el admin que se construye más adelante.

## Catálogo (`/pedido`)

- Buscador arriba, filtra por nombre en el cliente (no hace falta ir al servidor, el catálogo completo se trae una vez).
- Productos agrupados por categoría en secciones (a diferencia del admin, que usa pastillas de filtro — acá el spec original pide agrupado, y con pocas categorías por comercio tiene sentido mostrarlo así).
- Cada producto: foto (o placeholder si no tiene), nombre, unidad, precio sugerido si existe, indicador ❄ si `congelado`, tachado/deshabilitado si `disponible = false`.
- Input de cantidad + botón agregar; si el producto ya está en el carrito, se edita la cantidad ahí mismo (no hace falta ir al carrito para ajustar).
- Barra inferior fija (sticky) mientras el carrito tiene ítems: "🛒 N productos · $total → Ver pedido". Tocarla lleva a `/pedido/confirmar`.
- El carrito en sí vive en el cliente (estado de React + persistido en `sessionStorage` para sobrevivir un refresh accidental, no en el servidor hasta confirmar).

## Confirmar pedido (`/pedido/confirmar`)

- Lista de ítems del carrito con cantidad editable y opción de quitar.
- Selector de fecha: dos botones grandes, "Hoy" y "Mañana" (no calendario).
- Debajo del selector, texto simple con el turno calculado ("Este pedido entra en el reparto de la MAÑANA" / "... de la TARDE") — se recalcula en el cliente para mostrarlo, pero el valor que se guarda es el que recalcula el servidor al confirmar (nunca se confía en el cálculo del cliente para persistir).
- Tipo de etiqueta: precargado con `puntos_venta.etiqueta_default`, editable con un select (grande / chica / ambas).
- Total: suma solo de los productos que tienen `precio_sugerido` cargado; si hay productos sin precio en el carrito, se muestra una nota aclaratoria ("algunos productos no tienen precio cargado, no se cuentan en este total").
- Si el total no llega a `puntos_venta.pedido_minimo`: se muestra cuánto falta y el botón "Confirmar pedido" queda deshabilitado.
- Al confirmar: se crea el `pedido` + `pedido_items` en una operación server-side, recalculando `turno_reparto` y `fuera_de_horario` de cero (nunca confiando en lo que mandó el cliente). Redirige a `/pedido/listo`.

## Confirmación (`/pedido/listo`)

- Pantalla grande, tipografía clara: "¡Pedido confirmado!", con fecha de entrega, turno, y un resumen breve de los ítems. Botón para volver al catálogo (por si quieren hacer un pedido nuevo).

## Testing

- Igual que el sub-proyecto anterior: sin suite automatizada (decisión de spec ya confirmada). Verificación por `npm run build` + `npm run lint` + prueba manual contra Supabase real, con especial atención a la lógica del corte (probar los distintos casos de hora/fecha manualmente, incluyendo mockear la hora si hace falta para cubrir los bordes del corte de las 9am y el cierre de las 20hs).

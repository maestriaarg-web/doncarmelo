# Conciliación de pedidos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle a Don Carmelo la capacidad de marcar el avance real de cada pedido (confirmado → preparado → entregado, o cancelado) desde `/admin/pedidos`, y que ese estado afecte correctamente la lista de preparación consolidada y el cálculo de cantidad atípica que ya existen.

**Architecture:** La columna `pedidos.estado` ya existe en el schema pero solo admite `confirmado`/`cancelado` y nunca se usa en la práctica — se amplía el check constraint vía migración, se agregan tres Server Actions puntuales que la actualizan, y se suma una interfaz de botones secuenciales por pedido en la pantalla admin ya existente. Los dos cálculos que ya consumen la lista de pedidos del día (lista de preparación consolidada y promedio histórico para cantidad atípica) se ajustan para excluir pedidos cancelados.

**Tech Stack:** Next.js 16.2.10, React 19.2.4, TypeScript, Tailwind v4, Supabase — sin cambios de versión.

## Global Constraints

- Next.js 16.2.10 / React 19.2.4 / TypeScript / Tailwind v4 — ya instaladas, no se cambian.
- No hay suite de tests automatizada (decisión ya confirmada para todo el proyecto) — verificación es `npm run build` + `npm run lint` + prueba manual contra Supabase real.
- `ActionResult` pattern (`{error: string} | {success: true}`, nunca `throw`) para las tres Server Actions nuevas — mismo patrón ya usado en `excepciones/actions.ts`, `productos/actions.ts`, `puntos-venta/actions.ts`.
- Las Server Actions de cambio de estado NO validan la máquina de estados del lado del servidor (ej. no impiden pasar de `confirmado` a `entregado` directamente) — decisión explícita del spec: es una herramienta interna de un solo usuario admin, la UI ya guía el orden correcto con los botones secuenciales.
- El link "Cancelar" pide confirmación del navegador (`confirm()`) antes de ejecutar — a diferencia de "Baja"/"Borrar" en otras pantallas admin, que no la piden. Es la única acción de este plan que la usa.
- Los pedidos cancelados **siguen apareciendo** en la lista de `/admin/pedidos` (con su badge) — solo se excluyen de `consolidarPreparacion` y del promedio histórico de `calcularCantidadesAtipicas`. No se ocultan de la vista general.
- Admin routes usan el cliente RLS-scoped (`createClient()` de `@/lib/supabase/server`), nunca el service-role client — igual que el resto del panel admin.

---

## File Structure

```
supabase/migrations/0003_pedidos_estado_conciliacion.sql   # (create) amplía el check constraint de estado

src/lib/types.ts                                            # (modify) PedidoAdmin.estado, PedidoConItems.estado ya es string (sin cambio de tipo)
src/lib/admin/pedidos.ts                                    # (modify) select con estado, exclusión de cancelados en 2 funciones
src/app/admin/(dashboard)/pedidos/actions.ts                 # (create) marcarPreparado, marcarEntregado, cancelarPedido

src/app/admin/(dashboard)/pedidos/EstadoPedidoAcciones.tsx    # (create) badge + botones, único Client Component de este plan
src/app/admin/(dashboard)/pedidos/TurnoSection.tsx            # (modify) suma EstadoPedidoAcciones por pedido

src/app/pedido/historial/page.tsx                             # (modify) labels de estado del lado comercio
```

---

### Task 1: Migración + capa de datos

**Files:**
- Create: `supabase/migrations/0003_pedidos_estado_conciliacion.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/admin/pedidos.ts`
- Create: `src/app/admin/(dashboard)/pedidos/actions.ts`

**Interfaces:**
- Produces: `marcarPreparado(pedidoId: string): Promise<ActionResult>`, `marcarEntregado(pedidoId: string): Promise<ActionResult>`, `cancelarPedido(pedidoId: string): Promise<ActionResult>` (from `./actions`) — consumidos por Task 2. `PedidoAdmin.estado: 'confirmado' | 'preparado' | 'entregado' | 'cancelado'` — consumido por Tasks 1-2.

- [ ] **Step 1: Migración SQL**

```sql
-- supabase/migrations/0003_pedidos_estado_conciliacion.sql
-- El check constraint original de pedidos.estado (0001_init.sql) es anónimo,
-- así que Postgres le puso un nombre autogenerado que puede no ser
-- "pedidos_estado_check" si en algún momento se recreó la tabla distinto.
-- Este bloque lo busca por definición en vez de asumir el nombre, para que
-- la migración sea segura de aplicar sin depender de eso.
DO $$
DECLARE
  nombre_constraint text;
BEGIN
  SELECT conname INTO nombre_constraint
  FROM pg_constraint
  WHERE conrelid = 'pedidos'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%estado%';

  IF nombre_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pedidos DROP CONSTRAINT %I', nombre_constraint);
  END IF;
END $$;

ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('confirmado', 'preparado', 'entregado', 'cancelado'));
```

Aplicar este SQL contra el proyecto Supabase real (Dashboard → SQL Editor → pegar y ejecutar) — no hay tooling automático de migraciones en este proyecto, se aplican a mano igual que `0002_puntos_venta_celular.sql`.

- [ ] **Step 2: Tipo `PedidoAdmin.estado`**

En `src/lib/types.ts`, el tipo `PedidoAdmin` (actualmente sin campo `estado`) se modifica agregando el campo. Este es el único cambio en el archivo — el resto de `types.ts` (`ActionResult`, `Producto`, `PuntoVenta`, `ItemCarrito`, `PedidoConItems`, `ExcepcionCorte`) queda exactamente igual:

```ts
export type PedidoAdmin = {
  id: string
  fecha_entrega: string
  turno_reparto: 'manana' | 'tarde'
  tipo_etiqueta: 'grande' | 'chica' | 'ambas'
  estado: 'confirmado' | 'preparado' | 'entregado' | 'cancelado'
  fuera_de_horario: boolean
  creado_en: string
  puntos_venta: {
    id: string
    nombre: string
    direccion: string | null
  } | null
  pedido_items: {
    id: string
    cantidad: number
    producto_id: string
    productos: {
      nombre: string
      categoria: string
      unidad: string
    } | null
  }[]
}
```

- [ ] **Step 3: Capa de datos — select con estado, exclusión de cancelados**

```ts
// src/lib/admin/pedidos.ts — full file
import { createClient } from '@/lib/supabase/server'
import type { PedidoAdmin } from '@/lib/types'

const SELECT_PEDIDO_ADMIN =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, fuera_de_horario, creado_en, puntos_venta(id, nombre, direccion), pedido_items(id, cantidad, producto_id, productos(nombre, categoria, unidad))'

export async function obtenerPedidosDelDia(fecha: string): Promise<PedidoAdmin[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ADMIN)
    .eq('fecha_entrega', fecha)
    .order('creado_en', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PedidoAdmin[]
}

export async function obtenerPedidoPorId(id: string): Promise<PedidoAdmin | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_ADMIN)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as unknown as PedidoAdmin) ?? null
}

export type ItemPreparacion = {
  productoId: string
  nombre: string
  categoria: string
  unidad: string
  cantidadTotal: number
  cantidadPedidos: number
}

/**
 * Suma las cantidades de cada producto entre todos los pedidos dados
 * (pensado para un turno completo), para armar la lista de preparación.
 * Los pedidos cancelados no cuentan — no representan algo que preparar.
 */
export function consolidarPreparacion(pedidos: PedidoAdmin[]): ItemPreparacion[] {
  const mapa = new Map<string, ItemPreparacion>()

  for (const pedido of pedidos) {
    if (pedido.estado === 'cancelado') continue

    for (const item of pedido.pedido_items) {
      const producto = item.productos
      if (!producto) continue

      const existente = mapa.get(item.producto_id)
      if (existente) {
        existente.cantidadTotal += item.cantidad
        existente.cantidadPedidos += 1
      } else {
        mapa.set(item.producto_id, {
          productoId: item.producto_id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          unidad: producto.unidad,
          cantidadTotal: item.cantidad,
          cantidadPedidos: 1,
        })
      }
    }
  }

  return Array.from(mapa.values()).sort(
    (a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)
  )
}

/**
 * Promedio histórico de cantidad para ese producto+comercio, excluyendo el
 * pedido actual (nunca se compara un pedido contra sí mismo) y excluyendo
 * cualquier pedido cancelado (no representa consumo real).
 */
async function obtenerPromedioHistorico(
  puntoVentaId: string,
  productoId: string,
  excluirPedidoId: string
): Promise<number | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedido_items')
    .select('cantidad, pedido_id, pedidos!inner(punto_venta_id, estado)')
    .eq('producto_id', productoId)
    .eq('pedidos.punto_venta_id', puntoVentaId)
    .neq('pedido_id', excluirPedidoId)
    .neq('pedidos.estado', 'cancelado')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) return null

  const filas = data as unknown as { cantidad: number }[]
  const total = filas.reduce((acc, fila) => acc + fila.cantidad, 0)
  return total / filas.length
}

/**
 * Devuelve el set de claves "pedidoId:productoId" cuya cantidad es más del
 * doble del promedio histórico de ese producto para ese punto de venta.
 * Sin pedidos previos de ese producto para ese comercio, no hay base de
 * comparación y no se marca (evita falsos positivos en un producto nuevo).
 */
export async function calcularCantidadesAtipicas(pedidos: PedidoAdmin[]): Promise<Set<string>> {
  const atipicos = new Set<string>()

  // Sin cache por (puntoVenta, producto): cada pedido excluye SU PROPIO id de
  // la consulta, así que dos pedidos del mismo día con el mismo comercio y
  // producto necesitan cada uno su propio promedio (si uno reutilizara el
  // promedio del otro, terminaría comparándose contra un promedio que lo
  // incluye a él mismo).
  for (const pedido of pedidos) {
    const puntoVentaId = pedido.puntos_venta?.id
    if (!puntoVentaId) continue

    for (const item of pedido.pedido_items) {
      const promedio = await obtenerPromedioHistorico(puntoVentaId, item.producto_id, pedido.id)
      if (promedio != null && item.cantidad > promedio * 2) {
        atipicos.add(`${pedido.id}:${item.producto_id}`)
      }
    }
  }

  return atipicos
}
```

- [ ] **Step 4: Server Actions de cambio de estado**

```ts
// src/app/admin/(dashboard)/pedidos/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function marcarPreparado(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'preparado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  return { success: true }
}

export async function marcarEntregado(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'entregado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  return { success: true }
}

export async function cancelarPedido(pedidoId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'cancelado' })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  return { success: true }
}
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: builds exitosamente (nada consume `EstadoPedidoAcciones`/las Server Actions todavía desde la UI, así que esto solo confirma que no hay errores de TypeScript).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_pedidos_estado_conciliacion.sql src/lib/types.ts src/lib/admin/pedidos.ts "src/app/admin/(dashboard)/pedidos/actions.ts"
git commit -m "Add estado column expansion, cancelado exclusion, and pedido state Server Actions"
```

---

### Task 2: UI en /admin/pedidos — badges y botones de estado

**Files:**
- Create: `src/app/admin/(dashboard)/pedidos/EstadoPedidoAcciones.tsx`
- Modify: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`

**Interfaces:**
- Consumes: `marcarPreparado`/`marcarEntregado`/`cancelarPedido` from `./actions` (Task 1), `PedidoAdmin.estado` (Task 1).

- [ ] **Step 1: Componente de badge + botones (único Client Component de este plan)**

```tsx
// src/app/admin/(dashboard)/pedidos/EstadoPedidoAcciones.tsx
'use client'

import { useState } from 'react'
import type { ActionResult } from '@/lib/types'
import { marcarPreparado, marcarEntregado, cancelarPedido } from './actions'

const ESTADO_BADGE: Partial<
  Record<'preparado' | 'entregado' | 'cancelado', { label: string; className: string }>
> = {
  preparado: { label: 'Preparado', className: 'bg-neutral-200 text-neutral-700' },
  entregado: { label: '✓ Entregado', className: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-700 line-through' },
}

export function EstadoPedidoAcciones({
  pedidoId,
  estado,
}: {
  pedidoId: string
  estado: 'confirmado' | 'preparado' | 'entregado' | 'cancelado'
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ejecutar(accion: (id: string) => Promise<ActionResult>) {
    setCargando(true)
    setError(null)
    const resultado = await accion(pedidoId)
    if ('error' in resultado) setError(resultado.error)
    setCargando(false)
  }

  function handleCancelar() {
    if (!confirm('¿Seguro que querés cancelar este pedido?')) return
    ejecutar(cancelarPedido)
  }

  const badge = estado === 'confirmado' ? null : ESTADO_BADGE[estado]
  const puedeCancelar = estado !== 'entregado' && estado !== 'cancelado'

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {badge && (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      )}
      {estado === 'confirmado' && (
        <button
          onClick={() => ejecutar(marcarPreparado)}
          disabled={cargando}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-50"
        >
          Marcar preparado
        </button>
      )}
      {estado === 'preparado' && (
        <button
          onClick={() => ejecutar(marcarEntregado)}
          disabled={cargando}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-50"
        >
          Marcar entregado
        </button>
      )}
      {puedeCancelar && (
        <button
          onClick={handleCancelar}
          disabled={cargando}
          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          Cancelar
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Sumar el componente a cada pedido de la lista**

```tsx
// src/app/admin/(dashboard)/pedidos/TurnoSection.tsx — full file
import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion, type ItemPreparacion } from '@/lib/admin/pedidos'
import { EstadoPedidoAcciones } from './EstadoPedidoAcciones'

function agruparPorCategoria(items: ItemPreparacion[]): [string, ItemPreparacion[]][] {
  const mapa = new Map<string, ItemPreparacion[]>()
  for (const item of items) {
    const lista = mapa.get(item.categoria) ?? []
    lista.push(item)
    mapa.set(item.categoria, lista)
  }
  return Array.from(mapa.entries())
}

export function TurnoSection({
  titulo,
  fecha,
  turno,
  pedidos,
  atipicos,
}: {
  titulo: string
  fecha: string
  turno: 'manana' | 'tarde'
  pedidos: PedidoAdmin[]
  atipicos: Set<string>
}) {
  const preparacion = consolidarPreparacion(pedidos)
  const preparacionPorCategoria = agruparPorCategoria(preparacion)

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        {pedidos.length > 0 && (
          <a
            href={`/admin/remitos?fecha=${fecha}&turno=${turno}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700"
          >
            Imprimir todos los remitos
          </a>
        )}
      </div>

      {pedidos.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin pedidos para este turno.</p>
      ) : (
        <>
          <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-3">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Lista de preparación consolidada
            </h3>
            <div className="space-y-3 text-sm">
              {preparacionPorCategoria.map(([categoria, items]) => (
                <div key={categoria}>
                  <p className="mb-1 text-xs font-semibold uppercase text-neutral-400">
                    {categoria}
                  </p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.productoId} className="flex justify-between">
                        <span>{item.nombre}</span>
                        <span className="text-neutral-500">
                          {item.cantidadTotal} {item.unidad} ({item.cantidadPedidos} pedido(s))
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <ul className="space-y-2">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">
                    {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
                  </p>
                  <a
                    href={`/admin/remito/${pedido.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Imprimir remito
                  </a>
                </div>
                {pedido.fuera_de_horario && (
                  <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    ⚠ Fuera de horario
                  </span>
                )}
                <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                  {pedido.pedido_items.map((item) => {
                    const esAtipico = atipicos.has(`${pedido.id}:${item.producto_id}`)
                    return (
                      <li key={item.id} className={esAtipico ? 'font-medium text-amber-800' : ''}>
                        {item.cantidad} {item.productos?.unidad ?? ''} —{' '}
                        {item.productos?.nombre ?? 'Producto'}
                        {esAtipico && <span className="ml-2 text-xs">⚠ Cantidad atípica</span>}
                      </li>
                    )
                  })}
                </ul>
                <EstadoPedidoAcciones pedidoId={pedido.id} estado={pedido.estado} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

1. `/admin/pedidos` con un pedido real en estado `confirmado` — confirmá que aparece el botón "Marcar preparado" y el link "Cancelar", sin badge.
2. Click en "Marcar preparado" — confirmá que aparece el badge gris "Preparado" y el botón cambia a "Marcar entregado".
3. Click en "Marcar entregado" — confirmá el badge verde "✓ Entregado", sin botón de avance, sin link "Cancelar".
4. En otro pedido, click en "Cancelar" — confirmá que aparece el diálogo de confirmación del navegador, y que al aceptar el pedido queda con badge rojo tachado "Cancelado" y desaparece de la lista de preparación consolidada (pero sigue en la lista general de pedidos del turno).
5. Confirmá que un pedido con historial que incluye uno cancelado no lo cuenta para el promedio de la alerta de cantidad atípica (requiere un producto con al menos 2 pedidos previos no cancelados y uno cancelado, verificar que el promedio solo considera los no cancelados).

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/(dashboard)/pedidos"
git commit -m "Add estado badges and action buttons to pedidos screen"
```

---

### Task 3: Lado comercio — labels de estado en historial

**Files:**
- Modify: `src/app/pedido/historial/page.tsx`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Labels amigables**

```tsx
// src/app/pedido/historial/page.tsx — full file
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPuntoVentaId } from '@/lib/comercio/session'
import { obtenerHistorialPedidos } from '@/lib/comercio/pedidos'

const ETIQUETA_LABEL: Record<'grande' | 'chica' | 'ambas', string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

const ESTADO_LABEL: Record<string, string> = {
  confirmado: 'Confirmado',
  preparado: 'En preparación',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export const dynamic = 'force-dynamic'

export default async function HistorialPage() {
  const puntoVentaId = await getPuntoVentaId()
  if (!puntoVentaId) redirect('/')

  const pedidos = await obtenerHistorialPedidos(puntoVentaId)

  return (
    <div className="p-4 pb-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Historial de pedidos</h1>
        <Link href="/pedido" className="text-sm font-medium text-neutral-600">
          ← Volver al catálogo
        </Link>
      </div>

      {pedidos.length === 0 && (
        <p className="py-8 text-center text-neutral-500">Todavía no hiciste ningún pedido.</p>
      )}

      <ul className="space-y-2">
        {pedidos.map((pedido) => {
          const nombres = pedido.pedido_items
            .map((item) => item.productos?.nombre)
            .filter((nombre): nombre is string => Boolean(nombre))
          const resumen =
            nombres.length <= 3
              ? nombres.join(', ')
              : `${nombres.slice(0, 2).join(', ')} y ${nombres.length - 2} más`

          return (
            <li key={pedido.id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-foreground">{pedido.fecha_entrega}</p>
                <span className="text-sm text-neutral-500">
                  {pedido.turno_reparto === 'manana' ? 'Mañana' : 'Tarde'} ·{' '}
                  {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600">
                {pedido.pedido_items.length} producto(s): {resumen}
              </p>
              <p className="mt-1 text-xs text-neutral-400">
                Etiqueta: {ETIQUETA_LABEL[pedido.tipo_etiqueta]}
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run build && npm run lint && npm run dev`

Como comercio, `/pedido/historial` — confirmá que un pedido marcado "preparado" desde el admin en Task 2 muestra "En preparación" (no el string crudo "preparado"), y uno "entregado" muestra "Entregado".

- [ ] **Step 3: Commit**

```bash
git add src/app/pedido/historial/page.tsx
git commit -m "Add friendly estado labels to comercio historial"
```

---

### Task 4: Smoke test end-to-end + deploy

**Files:** ninguno (verificación únicamente)

- [ ] **Step 1: Build y lint completos**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 2: Confirmar que la migración ya está aplicada**

Antes de pushear, verificar contra el Supabase real (SQL Editor) que el constraint de `pedidos.estado` ya acepta los 4 valores — si Task 1 Step 1 no se aplicó todavía, aplicarla ahora. Sin esto, cualquier intento de marcar un pedido como preparado/entregado falla con un error de constraint violation.

- [ ] **Step 3: Push**

```bash
git push origin main
```

(Si falla por el problema de credencial cacheada de Windows: `git push "https://<TOKEN>@github.com/maestriaarg-web/doncarmelo.git" main:main` — nunca con `-u`.)

- [ ] **Step 4: Prueba end-to-end contra producción**

En `https://doncarmelo.vercel.app`:
1. Crear un pedido de prueba nuevo desde la app cliente para un comercio con historial (para poder verificar el efecto en cantidad atípica más abajo).
2. Desde `/admin/pedidos`, marcarlo preparado y después entregado — confirmar que los badges y botones cambian correctamente en cada paso.
3. Crear otro pedido de prueba y cancelarlo — confirmar el diálogo de confirmación, el badge rojo tachado, que desaparece de la lista de preparación consolidada de ese turno, y que sigue visible en la lista general.
4. Verificar en `/pedido/historial` (como ese comercio) que los tres pedidos muestran los labels correctos ("En preparación"/"Entregado"/"Cancelado", no los strings crudos).
5. Confirmar que ningún flujo existente se rompió: crear un pedido normal de punta a punta, y navegar el resto del admin (productos, puntos de venta, excepciones) sin errores.

- [ ] **Step 5: Reportar estado**

Sin commit para esta tarea — es el gate final de verificación. Con esto cierra el sub-proyecto 1 de 4 de Fase 2 (conciliación de pedidos); los siguientes son roles de usuario, integración WhatsApp, y zonas de reparto, en ese orden.

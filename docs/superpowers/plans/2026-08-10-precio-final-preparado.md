# Precio final al preparar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el precio estimado que se mostraba al armar el pedido por un monto final que el empleado carga al marcar un pedido "Preparado" — ese monto viaja en la notificación de WhatsApp y se muestra en el historial de pedidos del comercio.

**Architecture:** Columna nullable `monto_final` en `pedidos`, cargada en el mismo `update` que cambia `estado` a `'preparado'`. El input de monto en el admin se pre-completa con la suma de `precio_sugerido × cantidad` del pedido cuando esos precios existen (mismo cálculo que ya usa el carrito del comercio). El monto se propaga a dos superficies de lectura ya existentes: el mensaje de WhatsApp de `notificarEstadoPedido` y el historial de pedidos del comercio.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + `@supabase/ssr`). Sin cambios de dependencias.

## Global Constraints

- Sin suite de tests automatizada (decisión ya confirmada para todo el proyecto). Verificación: `npm run build && npm run lint` + prueba manual.
- Migraciones SQL se aplican manualmente por el usuario en el Supabase Dashboard SQL Editor — nunca ejecutar `execute_sql`/`apply_migration` contra el proyecto real desde acá.
- Copy en español, mismo tono que el resto del admin/app cliente.
- Reusar tokens de diseño existentes: `bg-primary`/`hover:bg-primary-hover` (solo CTA primario), `bg-background`, `text-foreground`, `text-neutral-*` para texto secundario.
- Server Actions devuelven `ActionResult` (`{error: string} | {success: true}`), nunca `throw`.
- Un monto total único por pedido (no por línea de producto). Obligatorio: `marcarPreparado` rechaza `montoFinal <= 0` o no numérico.
- Formato de moneda para los 3 puntos nuevos (input, mensaje de WhatsApp, historial): `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`. El resto de la app (catálogo/carrito) sigue con su formato actual (`$${valor.toFixed(2)}`) — no se toca.
- Fuera de alcance (no crear ninguna tarea para esto): editar el monto después de cargado, precio por línea de producto, cambios a los mensajes de WhatsApp de `confirmado`/`entregado`/`cancelado`.

---

### Task 1: Migración + tipos + datos de lectura (admin)

**Files:**
- Create: `supabase/migrations/0006_pedidos_monto_final.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/admin/pedidos.ts`

**Interfaces:**
- Produces: `PedidoAdmin.monto_final: number | null`, `PedidoAdmin.pedido_items[].productos.precio_sugerido: number | null`, `PedidoConItems.monto_final: number | null` — consumidos por Task 2, Task 3, Task 4.

- [ ] **Step 1: Migración — archivo completo**

```sql
-- supabase/migrations/0006_pedidos_monto_final.sql
-- Monto final que paga el comercio por el pedido, cargado por el empleado al
-- marcarlo "Preparado" (la mayoría de los productos son pesables, así que el
-- precio real recién se sabe ahí, no al armar el pedido). Nullable: los
-- pedidos existentes y los que todavía no llegaron a "preparado" no tienen
-- monto. Corré esto en Supabase SQL Editor.

alter table pedidos add column monto_final numeric;
```

- [ ] **Step 2: Tipos — `src/lib/types.ts`, archivo completo**

```ts
// Server Actions must return errors (not throw) so the message survives
// Next.js's production redaction of thrown Server Action errors.
export type ActionResult = { error: string } | { success: true }

export type Producto = {
  id: string
  nombre: string
  categoria: string
  unidad: string
  precio_sugerido: number | null
  congelado: boolean
  disponible: boolean
  foto_url: string | null
  activo: boolean
  creado_en: string
}

export type PuntoVenta = {
  id: string
  nombre: string
  direccion: string | null
  contacto: string | null
  celular: string
  zona: string | null
  etiqueta_default: 'grande' | 'chica' | 'ambas'
  pedido_minimo: number | null
  activo: boolean
  creado_en: string
}

export type ItemCarrito = {
  productoId: string
  nombre: string
  unidad: string
  precioSugerido: number | null
  cantidad: number
}

export type PedidoConItems = {
  id: string
  fecha_entrega: string
  turno_reparto: 'manana' | 'tarde'
  tipo_etiqueta: 'grande' | 'chica' | 'ambas'
  estado: string
  creado_en: string
  monto_final: number | null
  pedido_items: {
    cantidad: number
    producto_id: string
    productos: {
      nombre: string
      unidad: string
      precio_sugerido: number | null
      activo: boolean
      disponible: boolean
    } | null
  }[]
}

export type PedidoAdmin = {
  id: string
  fecha_entrega: string
  turno_reparto: 'manana' | 'tarde'
  tipo_etiqueta: 'grande' | 'chica' | 'ambas'
  estado: 'confirmado' | 'preparado' | 'entregado' | 'cancelado'
  fuera_de_horario: boolean
  creado_en: string
  monto_final: number | null
  puntos_venta: {
    id: string
    nombre: string
    direccion: string | null
    zona: string | null
  } | null
  pedido_items: {
    id: string
    cantidad: number
    producto_id: string
    productos: {
      nombre: string
      categoria: string
      unidad: string
      precio_sugerido: number | null
    } | null
  }[]
}

export type ExcepcionCorte = {
  id: string
  fecha: string
  hora_corte: string
  motivo: string | null
  creado_en: string
}

export type RolAdmin = 'admin' | 'empleado'

export type UsuarioAdmin = {
  id: string
  email: string
  rol: RolAdmin
}

export type Configuracion = {
  id: number
  backup_email: string | null
}
```

- [ ] **Step 3: Select embebido — `src/lib/admin/pedidos.ts`, archivo completo**

Único cambio real: `monto_final` se suma al nivel del pedido, y `precio_sugerido` se suma dentro de `productos(...)` en `SELECT_PEDIDO_ADMIN`. El resto del archivo queda igual.

```ts
// src/lib/admin/pedidos.ts
import { createClient } from '@/lib/supabase/server'
import type { PedidoAdmin } from '@/lib/types'

const SELECT_PEDIDO_ADMIN =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, fuera_de_horario, creado_en, monto_final, puntos_venta(id, nombre, direccion, zona), pedido_items(id, cantidad, producto_id, productos(nombre, categoria, unidad, precio_sugerido))'

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

- [ ] **Step 4: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores. (`monto_final` todavía no se usa en ningún lado, pero el tipo y el select ya están listos.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0006_pedidos_monto_final.sql src/lib/types.ts src/lib/admin/pedidos.ts
git commit -m "Add monto_final column to pedidos and thread it through admin types/select"
```

**Nota para quien ejecute este plan:** después de este task, recordarle al usuario que corra la migración `0006_pedidos_monto_final.sql` en el Supabase Dashboard SQL Editor antes de dar por buena la prueba manual final (Task 5).

---

### Task 2: Server Action + input de monto en `/admin/pedidos`

**Files:**
- Modify: `src/app/admin/(dashboard)/pedidos/actions.ts`
- Modify: `src/app/admin/(dashboard)/pedidos/EstadoPedidoAcciones.tsx`
- Modify: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`

**Interfaces:**
- Consumes: `PedidoAdmin.monto_final`, `PedidoAdmin.pedido_items[].productos.precio_sugerido` (Task 1).
- Produces: `marcarPreparado(pedidoId: string, montoFinal: number): Promise<ActionResult>` — nueva firma, reemplaza la anterior `marcarPreparado(pedidoId: string)`.

- [ ] **Step 1: `actions.ts` — archivo completo**

```ts
// src/app/admin/(dashboard)/pedidos/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notificarEstadoPedido } from '@/lib/whatsapp'
import type { ActionResult } from '@/lib/types'

export async function marcarPreparado(pedidoId: string, montoFinal: number): Promise<ActionResult> {
  if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
    return { error: 'Ingresá un monto válido.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'preparado', monto_final: montoFinal })
    .eq('id', pedidoId)

  if (error) return { error: error.message }
  revalidatePath('/admin/pedidos')
  await notificarEstadoPedido(pedidoId, 'preparado')
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
  await notificarEstadoPedido(pedidoId, 'entregado')
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
  await notificarEstadoPedido(pedidoId, 'cancelado')
  return { success: true }
}
```

- [ ] **Step 2: `EstadoPedidoAcciones.tsx` — archivo completo**

El botón "Marcar preparado" deja de llamar la acción directo: al hacer click, se reemplaza por un input numérico (pre-completado con la prop `montoSugerido` si no es null) + botón "Confirmar" + botón "Cancelar" que vuelve al botón original. El input no confirma con un valor vacío, `0` o negativo. Cuando `marcarPreparado` resuelve con éxito, `revalidatePath` en el server hace que el padre vuelva a renderizar este componente con `estado='preparado'` — la rama `estado === 'confirmado'` deja de matchear y el input desaparece solo, sin necesidad de un flag local de "éxito".

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
  montoSugerido,
}: {
  pedidoId: string
  estado: 'confirmado' | 'preparado' | 'entregado' | 'cancelado'
  montoSugerido: number | null
}) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mostrandoInputMonto, setMostrandoInputMonto] = useState(false)
  const [monto, setMonto] = useState(montoSugerido != null ? String(montoSugerido) : '')

  async function ejecutar(accion: (id: string) => Promise<ActionResult>) {
    setCargando(true)
    setError(null)
    try {
      const resultado = await accion(pedidoId)
      if ('error' in resultado) setError(resultado.error)
    } catch {
      setError('No pudimos actualizar el pedido. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  async function handleConfirmarPreparado() {
    const montoFinal = Number(monto)
    if (!Number.isFinite(montoFinal) || montoFinal <= 0) {
      setError('Ingresá un monto válido.')
      return
    }
    setCargando(true)
    setError(null)
    try {
      const resultado = await marcarPreparado(pedidoId, montoFinal)
      if ('error' in resultado) setError(resultado.error)
    } catch {
      setError('No pudimos actualizar el pedido. Intentá de nuevo.')
    } finally {
      setCargando(false)
    }
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
      {estado === 'confirmado' && !mostrandoInputMonto && (
        <button
          onClick={() => setMostrandoInputMonto(true)}
          disabled={cargando}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 disabled:opacity-50"
        >
          Marcar preparado
        </button>
      )}
      {estado === 'confirmado' && mostrandoInputMonto && (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Monto final"
            className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-xs"
          />
          <button
            onClick={handleConfirmarPreparado}
            disabled={cargando}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            onClick={() => {
              setMostrandoInputMonto(false)
              setError(null)
            }}
            disabled={cargando}
            className="text-xs font-medium text-neutral-500"
          >
            Cancelar
          </button>
        </div>
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

- [ ] **Step 3: `TurnoSection.tsx` — archivo completo**

Suma `calcularMontoSugerido` (suma `precio_sugerido × cantidad` de los ítems del pedido que tienen precio cargado; `null` si ninguno lo tiene) y se lo pasa a `EstadoPedidoAcciones` como `montoSugerido`.

```tsx
// src/app/admin/(dashboard)/pedidos/TurnoSection.tsx
import type { PedidoAdmin } from '@/lib/types'
import { consolidarPreparacion, type ItemPreparacion } from '@/lib/admin/pedidos'
import { EstadoPedidoAcciones } from './EstadoPedidoAcciones'

const SIN_ZONA = 'Sin zona'

function agruparPorCategoria(items: ItemPreparacion[]): [string, ItemPreparacion[]][] {
  const mapa = new Map<string, ItemPreparacion[]>()
  for (const item of items) {
    const lista = mapa.get(item.categoria) ?? []
    lista.push(item)
    mapa.set(item.categoria, lista)
  }
  return Array.from(mapa.entries())
}

function agruparPedidosPorZona(pedidos: PedidoAdmin[]): [string, PedidoAdmin[]][] {
  const mapa = new Map<string, PedidoAdmin[]>()
  for (const pedido of pedidos) {
    const zona = pedido.puntos_venta?.zona || SIN_ZONA
    const lista = mapa.get(zona) ?? []
    lista.push(pedido)
    mapa.set(zona, lista)
  }
  return Array.from(mapa.entries()).sort(([a], [b]) => {
    if (a === SIN_ZONA) return 1
    if (b === SIN_ZONA) return -1
    return a.localeCompare(b)
  })
}

/**
 * Suma precio_sugerido × cantidad de los ítems del pedido que tienen precio
 * cargado, como punto de partida para el monto final que se carga al marcar
 * "Preparado". Si ningún ítem tiene precio, no hay nada que sugerir.
 */
function calcularMontoSugerido(pedido: PedidoAdmin): number | null {
  const conPrecio = pedido.pedido_items.filter((item) => item.productos?.precio_sugerido != null)
  if (conPrecio.length === 0) return null
  return conPrecio.reduce(
    (acc, item) => acc + (item.productos!.precio_sugerido as number) * item.cantidad,
    0
  )
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
  const pedidosPorZona = agruparPedidosPorZona(pedidos)

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

          <div className="space-y-4">
            {pedidosPorZona.map(([zona, pedidosDeZona]) => (
              <div key={zona}>
                <h3 className="mb-2 text-xs font-semibold uppercase text-neutral-400">{zona}</h3>
                <ul className="space-y-2">
                  {pedidosDeZona.map((pedido) => (
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
                      <EstadoPedidoAcciones
                        pedidoId={pedido.id}
                        estado={pedido.estado}
                        montoSugerido={calcularMontoSugerido(pedido)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/pedidos/actions.ts" "src/app/admin/(dashboard)/pedidos/EstadoPedidoAcciones.tsx" "src/app/admin/(dashboard)/pedidos/TurnoSection.tsx"
git commit -m "Require a monto final when marking a pedido as preparado"
```

---

### Task 3: Mensaje de WhatsApp con el monto

**Files:**
- Modify: `src/lib/whatsapp.ts`

**Interfaces:**
- No consume tipos de Task 1/2 — `notificarEstadoPedido` hace su propia consulta a `pedidos`, independiente de `SELECT_PEDIDO_ADMIN`. Solo depende de que la columna `monto_final` exista en la base (migración de Task 1).

- [ ] **Step 1: `whatsapp.ts` — archivo completo**

El mensaje de `preparado` pasa a incluir el monto formateado cuando existe; si `monto_final` viniera `null` (no debería pasar dado que ahora es obligatorio, pero cubre filas viejas sin migrar), cae al texto genérico sin el monto. Los otros 3 mensajes no cambian de contenido, solo de firma (reciben el tercer parámetro y lo ignoran).

```ts
// src/lib/whatsapp.ts
import { createServiceClient } from '@/lib/supabase/service'

type EstadoPedido = 'confirmado' | 'preparado' | 'entregado' | 'cancelado'

function formatearMonto(monto: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)
}

const MENSAJE_POR_ESTADO: Record<
  EstadoPedido,
  (fecha: string, turno: string, montoFinal: number | null) => string
> = {
  confirmado: (fecha, turno) =>
    `Hola! Tu pedido para el ${fecha} (turno ${turno}) fue confirmado. Te avisamos cuando esté listo.`,
  preparado: (fecha, turno, montoFinal) =>
    montoFinal != null
      ? `Tu pedido para el ${fecha} (turno ${turno}) ya está preparado. Total a pagar: ${formatearMonto(montoFinal)}.`
      : `Tu pedido para el ${fecha} (turno ${turno}) ya está preparado.`,
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
 * Busca fecha/turno/celular/monto del pedido, arma el mensaje según el
 * estado, y dispara el envío. Nunca lanza — un fallo acá no debe romper el
 * flujo real (confirmar/marcar/cancelar un pedido) que la llamó.
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
      .select('fecha_entrega, turno_reparto, monto_final, puntos_venta(celular)')
      .eq('id', pedidoId)
      .maybeSingle()

    if (error || !data) {
      console.error('notificarEstadoPedido: no se pudo encontrar el pedido', pedidoId, error)
      return
    }

    const pedido = data as unknown as {
      fecha_entrega: string
      turno_reparto: 'manana' | 'tarde'
      monto_final: number | null
      puntos_venta: { celular: string } | null
    }

    const celular = pedido.puntos_venta?.celular
    if (!celular) {
      console.error('notificarEstadoPedido: el punto de venta no tiene celular cargado', pedidoId)
      return
    }

    const turnoLabel = pedido.turno_reparto === 'manana' ? 'mañana' : 'tarde'
    const mensaje = MENSAJE_POR_ESTADO[estado](pedido.fecha_entrega, turnoLabel, pedido.monto_final)
    const numero = `+549${celular}`

    await enviarWhatsApp(numero, mensaje)
  } catch (err) {
    console.error('notificarEstadoPedido: error inesperado', pedidoId, err)
  }
}
```

- [ ] **Step 2: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whatsapp.ts
git commit -m "Include monto final in the WhatsApp preparado notification"
```

---

### Task 4: Historial del comercio — mostrar el monto

**Files:**
- Modify: `src/lib/comercio/pedidos.ts`
- Modify: `src/app/pedido/historial/page.tsx`

**Interfaces:**
- Consumes: `PedidoConItems.monto_final` (Task 1).

- [ ] **Step 1: `comercio/pedidos.ts` — archivo completo**

Único cambio real: `monto_final` se suma al nivel del pedido en `SELECT_PEDIDO_CON_ITEMS`. El resto del archivo queda igual.

```ts
// src/lib/comercio/pedidos.ts
import { createServiceClient } from '@/lib/supabase/service'
import type { PedidoConItems, Producto } from '@/lib/types'

const SELECT_PEDIDO_CON_ITEMS =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, creado_en, monto_final, pedido_items(cantidad, producto_id, productos(nombre, unidad, precio_sugerido, activo, disponible))'

export async function obtenerHistorialPedidos(puntoVentaId: string): Promise<PedidoConItems[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_CON_ITEMS)
    .eq('punto_venta_id', puntoVentaId)
    .order('creado_en', { ascending: false })

  // Un error acá NO debe verse como "todavía no hiciste ningún pedido" —
  // eso sería mostrarle al comercio una mentira. Se deja que el error
  // boundary de la página lo maneje en vez de devolver una lista vacía.
  if (error) throw new Error(error.message)

  return (data ?? []) as unknown as PedidoConItems[]
}

export async function obtenerUltimoPedido(puntoVentaId: string): Promise<PedidoConItems | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(SELECT_PEDIDO_CON_ITEMS)
    .eq('punto_venta_id', puntoVentaId)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)

  return (data as unknown as PedidoConItems) ?? null
}

export async function tienePedidosPrevios(puntoVentaId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id')
    .eq('punto_venta_id', puntoVentaId)
    .limit(1)

  if (error) {
    // Esto solo controla si se muestran el botón "repetir" y la sección de
    // frecuentes — un error acá no debe romper el catálogo. Se degrada a
    // "sin historial" (los oculta), pero queda registrado para poder
    // diagnosticarlo si empieza a pasar seguido.
    console.error('tienePedidosPrevios: error consultando pedidos', error)
    return false
  }

  return (data?.length ?? 0) > 0
}

/**
 * Los 5 (por defecto) productos que aparecieron en más pedidos DISTINTOS del
 * punto de venta (no la cantidad total pedida). Solo productos que siguen
 * activos y disponibles hoy.
 */
export async function obtenerProductosFrecuentes(
  puntoVentaId: string,
  limite = 5
): Promise<Producto[]> {
  const supabase = createServiceClient()

  const { data: filas, error: errorFilas } = await supabase
    .from('pedido_items')
    .select('producto_id, pedido_id, pedidos!inner(punto_venta_id)')
    .eq('pedidos.punto_venta_id', puntoVentaId)

  if (errorFilas) {
    // Igual que tienePedidosPrevios: es una sección de conveniencia, un
    // error acá solo la oculta (no rompe el catálogo), pero se registra.
    console.error('obtenerProductosFrecuentes: error consultando pedido_items', errorFilas)
    return []
  }

  if (!filas || filas.length === 0) return []

  const pedidosPorProducto = new Map<string, Set<string>>()
  for (const fila of filas as unknown as { producto_id: string; pedido_id: string }[]) {
    const set = pedidosPorProducto.get(fila.producto_id) ?? new Set<string>()
    set.add(fila.pedido_id)
    pedidosPorProducto.set(fila.producto_id, set)
  }

  const idsRankeados = Array.from(pedidosPorProducto.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .map(([productoId]) => productoId)

  const { data: productos, error: errorProductos } = await supabase
    .from('productos')
    .select('*')
    .in('id', idsRankeados)
    .eq('activo', true)
    .eq('disponible', true)

  if (errorProductos) {
    console.error('obtenerProductosFrecuentes: error consultando productos', errorProductos)
    return []
  }

  if (!productos) return []

  const productosPorId = new Map(productos.map((p) => [p.id, p as Producto]))
  const ranking: Producto[] = []
  for (const id of idsRankeados) {
    const producto = productosPorId.get(id)
    if (producto) ranking.push(producto)
    if (ranking.length === limite) break
  }
  return ranking
}
```

- [ ] **Step 2: `historial/page.tsx` — archivo completo**

Agrega una línea "Total a pagar" cuando el pedido está `preparado` o `entregado` y tiene `monto_final` cargado.

```tsx
// src/app/pedido/historial/page.tsx
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

function formatearMonto(monto: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)
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
              {(pedido.estado === 'preparado' || pedido.estado === 'entregado') &&
                pedido.monto_final != null && (
                  <p className="mt-1 text-sm font-medium text-foreground">
                    Total a pagar: {formatearMonto(pedido.monto_final)}
                  </p>
                )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/comercio/pedidos.ts "src/app/pedido/historial/page.tsx"
git commit -m "Show monto final on the comercio's order history"
```

---

### Task 5: Smoke test end-to-end + deploy

No es un task de código — es la verificación manual final, ejecutada directamente (sin subagente), igual que el cierre de cada sub-proyecto anterior.

- [ ] Confirmar con el usuario que ya corrió la migración `0006_pedidos_monto_final.sql` en el Supabase Dashboard.
- [ ] `git push` de todos los commits de este plan.
- [ ] Deploy a producción (Vercel) y esperar a que termine.
- [ ] En `/admin/pedidos`, sobre un pedido de prueba SIN precios cargados en sus productos: click en "Marcar preparado", confirmar que el input arranca vacío, que no deja confirmar en $0 ni vacío, cargar un monto y confirmar que el pedido pasa a "Preparado".
- [ ] Sobre un pedido de prueba con productos que SÍ tienen `precio_sugerido` cargado: confirmar que el input arranca pre-completado con la suma correcta, y que se puede editar antes de confirmar.
- [ ] Revisar los logs de Vercel (o la consola) para confirmar que `notificarEstadoPedido` no tiró ningún error al armar el mensaje de "preparado" con el monto.
- [ ] Como el comercio de prueba, entrar a `/pedido/historial` y confirmar que el pedido recién marcado "Preparado" muestra "Total a pagar" con el monto correcto, formateado en pesos argentinos.
- [ ] Confirmar que un pedido en estado "Confirmado" (sin pasar por preparado todavía) NO muestra ninguna línea de monto en el historial.
- [ ] Limpiar los datos de prueba que no correspondan a comercios reales.

---

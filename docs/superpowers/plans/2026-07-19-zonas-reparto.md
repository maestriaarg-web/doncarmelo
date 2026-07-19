# Zonas de reparto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar una zona de reparto de texto libre a cada punto de venta, y usarla para agrupar pedidos dentro de un turno en `/admin/pedidos`, filtrar puntos de venta en su ABM, y mostrarla en el remito impreso.

**Architecture:** Columna nullable `zona` en `puntos_venta`. El resto es replicar dos patrones ya existentes en el proyecto: el agrupamiento por categoría que ya usa `TurnoSection` para la lista de preparación, y el patrón de filtro+autocompletado por categoría que ya usan `ProductosClient`/`ProductoForm`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres + `@supabase/ssr`). Sin cambios de dependencias.

## Global Constraints

- Sin suite de tests automatizada (decisión ya confirmada para todo el proyecto). Verificación: `npm run build && npm run lint` + prueba manual.
- Migraciones SQL se aplican manualmente por el usuario en el Supabase Dashboard SQL Editor — nunca ejecutar `execute_sql`/`apply_migration` contra el proyecto real desde acá.
- Copy en español, mismo tono que el resto del admin.
- Reusar tokens de diseño existentes: `bg-primary`/`hover:bg-primary-hover` (solo CTA primario), `bg-background`, `text-foreground`, `text-neutral-*` para texto secundario.
- Server Actions devuelven `ActionResult` (`{error: string} | {success: true}`), nunca `throw`.
- `zona` es texto libre opcional (`string | null`), sin geolocalización ni validación de valores — cualquier string es válido, incluida la ausencia de zona.
- Fuera de alcance (no crear ninguna tarea para esto): mapas/rutas, cambios en la app cliente (los comercios no ven zona), migración automática de zona a comercios existentes.

---

### Task 1: Migración + capa de datos

**Files:**
- Create: `supabase/migrations/0004_puntos_venta_zona.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/admin/pedidos.ts`

**Interfaces:**
- Produces: `PuntoVenta.zona: string | null`, `PedidoAdmin.puntos_venta.zona: string | null` — consumidos por Task 2, Task 3, Task 4.

- [ ] **Step 1: Migración — archivo completo**

```sql
-- supabase/migrations/0004_puntos_venta_zona.sql
-- Suma una zona de reparto libre a cada punto de venta, para agrupar pedidos
-- dentro de un turno más allá del orden de creación. Nullable: los comercios
-- existentes quedan sin zona hasta que el admin los edite manualmente.
-- Corré esto en Supabase SQL Editor.

alter table puntos_venta add column zona text;
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
```

- [ ] **Step 3: Select embebido — `src/lib/admin/pedidos.ts`, archivo completo**

Único cambio real: `puntos_venta(id, nombre, direccion)` pasa a `puntos_venta(id, nombre, direccion, zona)` en `SELECT_PEDIDO_ADMIN`. El resto del archivo queda igual.

```ts
// src/lib/admin/pedidos.ts
import { createClient } from '@/lib/supabase/server'
import type { PedidoAdmin } from '@/lib/types'

const SELECT_PEDIDO_ADMIN =
  'id, fecha_entrega, turno_reparto, tipo_etiqueta, estado, fuera_de_horario, creado_en, puntos_venta(id, nombre, direccion, zona), pedido_items(id, cantidad, producto_id, productos(nombre, categoria, unidad))'

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
Expected: ambos sin errores. (`zona` todavía no se usa en ningún lado, pero el tipo y el select ya están listos.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_puntos_venta_zona.sql src/lib/types.ts src/lib/admin/pedidos.ts
git commit -m "Add zona column to puntos_venta and thread it through types/select"
```

**Nota para quien ejecute este plan:** después de este task, recordarle al usuario que corra la migración `0004_puntos_venta_zona.sql` en el Supabase Dashboard SQL Editor antes de dar por buena la prueba manual final (Task 5). Sin la columna en la base real, los siguientes tasks compilan pero cargar una zona en producción fallará.

---

### Task 2: `/admin/pedidos` — agrupar pedidos por zona dentro de cada turno

**Files:**
- Modify: `src/app/admin/(dashboard)/pedidos/TurnoSection.tsx`

**Interfaces:**
- Consumes: `PedidoAdmin.puntos_venta.zona` (Task 1).

- [ ] **Step 1: `TurnoSection.tsx` — archivo completo**

Suma `agruparPedidosPorZona` (mismo patrón que `agruparPorCategoria`, ya en este archivo, que agrupa la lista de preparación) y reemplaza el `<ul>` plano de pedidos individuales por un agrupamiento por zona con encabezado. Zonas ordenadas alfabéticamente; pedidos sin zona van al final bajo "Sin zona". La lista de preparación consolidada de arriba no cambia.

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
                      <EstadoPedidoAcciones pedidoId={pedido.id} estado={pedido.estado} />
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

- [ ] **Step 2: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/(dashboard)/pedidos/TurnoSection.tsx"
git commit -m "Group pedidos by zona within each turno in /admin/pedidos"
```

---

### Task 3: `/admin/puntos-venta` — campo de zona, autocompletado y filtro

**Files:**
- Modify: `src/app/admin/(dashboard)/puntos-venta/actions.ts`
- Modify: `src/app/admin/(dashboard)/puntos-venta/PuntoVentaForm.tsx`
- Modify: `src/app/admin/(dashboard)/puntos-venta/PuntosVentaClient.tsx`

**Interfaces:**
- Consumes: `PuntoVenta.zona` (Task 1).
- Produces: `PuntoVentaInput.zona: string | null` — usado internamente por los tres archivos de este task.

- [ ] **Step 1: `actions.ts` — archivo completo**

Único cambio real: `zona: string | null` se suma a `PuntoVentaInput`. Los tres Server Actions ya hacen `{ ...input, ... }` al insertar/actualizar, así que `zona` viaja automáticamente sin tocar los cuerpos de `crearPuntoVenta`/`actualizarPuntoVenta`.

```ts
// src/app/admin/(dashboard)/puntos-venta/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export type PuntoVentaInput = {
  nombre: string
  direccion: string | null
  contacto: string | null
  celular: string
  zona: string | null
  etiqueta_default: 'grande' | 'chica' | 'ambas'
  pedido_minimo: number | null
}

// Deja solo dígitos, así "3492 40-1234" y "3492401234" se guardan (y comparan) igual.
function normalizarCelular(celular: string): string {
  return celular.replace(/\D/g, '')
}

export async function crearPuntoVenta(input: PuntoVentaInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('puntos_venta')
    .insert({ ...input, celular: normalizarCelular(input.celular) })
  if (error) return { error: error.message }
  revalidatePath('/admin/puntos-venta')
  return { success: true }
}

export async function actualizarPuntoVenta(id: string, input: PuntoVentaInput): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('puntos_venta')
    .update({ ...input, celular: normalizarCelular(input.celular) })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/puntos-venta')
  return { success: true }
}

export async function cambiarActivoPuntoVenta(id: string, activo: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('puntos_venta').update({ activo }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/puntos-venta')
  return { success: true }
}
```

- [ ] **Step 2: `PuntoVentaForm.tsx` — archivo completo**

Suma un campo "Zona de reparto" con `<datalist>` de zonas ya usadas (recibidas como prop `zonasExistentes`, igual que `categoriasExistentes` en `ProductoForm`). Va después de "Celular" y antes de la grilla de etiqueta/pedido mínimo.

```tsx
// src/app/admin/(dashboard)/puntos-venta/PuntoVentaForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import type { ActionResult, PuntoVenta } from '@/lib/types'
import type { PuntoVentaInput } from './actions'

export function PuntoVentaForm({
  puntoVenta,
  zonasExistentes,
  onSubmit,
  onCancel,
}: {
  puntoVenta?: PuntoVenta
  zonasExistentes: string[]
  onSubmit: (input: PuntoVentaInput) => Promise<ActionResult>
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(puntoVenta?.nombre ?? '')
  const [direccion, setDireccion] = useState(puntoVenta?.direccion ?? '')
  const [contacto, setContacto] = useState(puntoVenta?.contacto ?? '')
  const [celular, setCelular] = useState(puntoVenta?.celular ?? '')
  const [zona, setZona] = useState(puntoVenta?.zona ?? '')
  const [etiquetaDefault, setEtiquetaDefault] = useState<PuntoVentaInput['etiqueta_default']>(
    puntoVenta?.etiqueta_default ?? 'ambas'
  )
  const [pedidoMinimo, setPedidoMinimo] = useState(
    puntoVenta?.pedido_minimo != null ? String(puntoVenta.pedido_minimo) : ''
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const result = await onSubmit({
      nombre,
      direccion: direccion || null,
      contacto: contacto || null,
      celular,
      zona: zona || null,
      etiqueta_default: etiquetaDefault,
      pedido_minimo: pedidoMinimo ? Number(pedidoMinimo) : null,
    })
    if ('error' in result) {
      setError(
        result.error.includes('duplicate key')
          ? 'Ese celular ya está registrado para otro punto de venta.'
          : result.error
      )
      setGuardando(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
    >
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Dirección</label>
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Contacto</label>
        <input
          value={contacto}
          onChange={(e) => setContacto(e.target.value)}
          placeholder="Teléfono o WhatsApp"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Celular</label>
        <input
          type="tel"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          required
          placeholder="3492 40-1234"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
        <p className="mt-1 text-sm text-neutral-500">
          Es el número que el comercio va a usar para entrar a hacer pedidos. Podés escribirlo con
          espacios o guiones, se guarda solo con los números.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">Zona de reparto</label>
        <input
          value={zona}
          onChange={(e) => setZona(e.target.value)}
          list="zonas-datalist"
          placeholder="Opcional, para organizar el reparto"
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
        />
        <datalist id="zonas-datalist">
          {zonasExistentes.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p className="mt-1 text-sm text-neutral-500">
          Es interna, solo la ve el admin — sirve para agrupar los pedidos por recorrido de reparto.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Etiqueta por defecto
          </label>
          <select
            value={etiquetaDefault}
            onChange={(e) =>
              setEtiquetaDefault(e.target.value as PuntoVentaInput['etiqueta_default'])
            }
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          >
            <option value="grande">Grande sin precio</option>
            <option value="chica">Chica con precio sugerido</option>
            <option value="ambas">Ambas</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Pedido mínimo (opcional)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={pedidoMinimo}
            onChange={(e) => setPedidoMinimo(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-neutral-300 px-4 py-2.5 text-base font-medium text-neutral-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: `PuntosVentaClient.tsx` — archivo completo**

Suma pills de filtro por zona (mismo patrón que el filtro de categoría en `ProductosClient`), zona visible en el listado, y pasa `zonasExistentes` al formulario. Puntos de venta sin zona cuentan como "Sin zona" tanto en las pills como en el listado — mismo fallback que `TurnoSection`.

```tsx
// src/app/admin/(dashboard)/puntos-venta/PuntosVentaClient.tsx
'use client'

import { useState } from 'react'
import type { ActionResult, PuntoVenta } from '@/lib/types'
import { PuntoVentaForm } from './PuntoVentaForm'
import {
  crearPuntoVenta,
  actualizarPuntoVenta,
  cambiarActivoPuntoVenta,
  type PuntoVentaInput,
} from './actions'

const SIN_ZONA = 'Sin zona'

const ETIQUETA_LABEL: Record<PuntoVenta['etiqueta_default'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function PuntosVentaClient({ puntosVenta }: { puntosVenta: PuntoVenta[] }) {
  const [modo, setModo] = useState<'lista' | 'nuevo' | 'editar'>('lista')
  const [editando, setEditando] = useState<PuntoVenta | null>(null)
  const [filtroZona, setFiltroZona] = useState('todas')

  const zonasExistentes = Array.from(
    new Set(puntosVenta.filter((pv) => pv.zona).map((pv) => pv.zona as string))
  )
  const zonasFiltro = Array.from(new Set(puntosVenta.map((pv) => pv.zona || SIN_ZONA)))
  const visibles = puntosVenta.filter(
    (pv) => filtroZona === 'todas' || (pv.zona || SIN_ZONA) === filtroZona
  )

  async function handleCrear(input: PuntoVentaInput): Promise<ActionResult> {
    const result = await crearPuntoVenta(input)
    if ('success' in result) setModo('lista')
    return result
  }

  async function handleActualizar(input: PuntoVentaInput): Promise<ActionResult> {
    if (!editando) return { error: 'No hay punto de venta seleccionado' }
    const result = await actualizarPuntoVenta(editando.id, input)
    if ('success' in result) {
      setModo('lista')
      setEditando(null)
    }
    return result
  }

  async function handleCambiarActivo(id: string, activo: boolean) {
    const result = await cambiarActivoPuntoVenta(id, activo)
    if ('error' in result) alert(result.error)
  }

  if (modo === 'nuevo') {
    return (
      <PuntoVentaForm
        zonasExistentes={zonasExistentes}
        onSubmit={handleCrear}
        onCancel={() => setModo('lista')}
      />
    )
  }

  if (modo === 'editar' && editando) {
    return (
      <PuntoVentaForm
        puntoVenta={editando}
        zonasExistentes={zonasExistentes}
        onSubmit={handleActualizar}
        onCancel={() => {
          setModo('lista')
          setEditando(null)
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Puntos de venta</h1>
        <button
          onClick={() => setModo('nuevo')}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover"
        >
          + Nuevo punto de venta
        </button>
      </div>

      {zonasFiltro.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setFiltroZona('todas')}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              filtroZona === 'todas' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            Todas
          </button>
          {zonasFiltro.map((z) => (
            <button
              key={z}
              onClick={() => setFiltroZona(z)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                filtroZona === z ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {visibles.map((pv) => (
          <li
            key={pv.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="min-w-[12rem] flex-1">
              <p className="font-medium text-foreground">{pv.nombre}</p>
              <p className="text-sm text-neutral-500">
                Celular: {pv.celular} · {ETIQUETA_LABEL[pv.etiqueta_default]} · Zona:{' '}
                {pv.zona ?? SIN_ZONA}
                {pv.pedido_minimo != null && ` · Mínimo $${pv.pedido_minimo}`}
              </p>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={pv.activo}
                onChange={(e) => handleCambiarActivo(pv.id, e.target.checked)}
              />
              Activo
            </label>
            <button
              onClick={() => {
                setEditando(pv)
                setModo('editar')
              }}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Editar
            </button>
          </li>
        ))}
        {visibles.length === 0 && (
          <p className="py-8 text-center text-neutral-500">No hay puntos de venta en esta zona.</p>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/(dashboard)/puntos-venta/actions.ts" "src/app/admin/(dashboard)/puntos-venta/PuntoVentaForm.tsx" "src/app/admin/(dashboard)/puntos-venta/PuntosVentaClient.tsx"
git commit -m "Add zona field, autocomplete, and filter to puntos de venta ABM"
```

---

### Task 4: Remito imprimible — línea de zona

**Files:**
- Modify: `src/app/admin/remito/RemitoContent.tsx`

**Interfaces:**
- Consumes: `PedidoAdmin.puntos_venta.zona` (Task 1). Este componente ya es compartido por `/admin/remito/[id]` (remito individual) y `/admin/remitos` (remitos de todo un turno), así que un solo cambio cubre ambas vistas.

- [ ] **Step 1: `RemitoContent.tsx` — archivo completo**

Suma la línea de zona justo después de la dirección, solo si el punto de venta tiene una zona cargada.

```tsx
// src/app/admin/remito/RemitoContent.tsx
import type { PedidoAdmin } from '@/lib/types'

const ETIQUETA_LABEL: Record<PedidoAdmin['tipo_etiqueta'], string> = {
  grande: 'Grande sin precio',
  chica: 'Chica con precio sugerido',
  ambas: 'Ambas',
}

export function RemitoContent({ pedido }: { pedido: PedidoAdmin }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-bold text-foreground">
        {pedido.puntos_venta?.nombre ?? 'Punto de venta'}
      </h2>
      {pedido.puntos_venta?.direccion && (
        <p className="text-sm text-neutral-600">{pedido.puntos_venta.direccion}</p>
      )}
      {pedido.puntos_venta?.zona && (
        <p className="text-sm text-neutral-600">Zona: {pedido.puntos_venta.zona}</p>
      )}
      <p className="mt-2 text-sm text-foreground">
        Fecha de entrega: <strong>{pedido.fecha_entrega}</strong> · Turno:{' '}
        <strong>{pedido.turno_reparto === 'manana' ? 'Mañana' : 'Tarde'}</strong>
      </p>
      <p className="text-sm text-foreground">
        Etiqueta: <strong>{ETIQUETA_LABEL[pedido.tipo_etiqueta]}</strong>
      </p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left">
            <th className="py-1">Producto</th>
            <th className="py-1 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {pedido.pedido_items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-100">
              <td className="py-1">{item.productos?.nombre ?? 'Producto'}</td>
              <td className="py-1 text-right">
                {item.cantidad} {item.productos?.unidad ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/remito/RemitoContent.tsx
git commit -m "Show zona on printable remito when the punto de venta has one"
```

---

### Task 5: Smoke test end-to-end + deploy

No es un task de código — es la verificación manual final, ejecutada directamente (sin subagente), igual que el cierre de cada sub-proyecto anterior de Fase 2.

- [ ] Confirmar con el usuario que ya corrió la migración `0004_puntos_venta_zona.sql` en el Supabase Dashboard.
- [ ] `git push` de todos los commits de este plan.
- [ ] Deploy a producción (Vercel) y esperar a que termine.
- [ ] En `/admin/puntos-venta`: cargar zona en 2-3 puntos de venta de prueba (al menos dos con la misma zona, uno sin zona), confirmar que el filtro por zona funciona y que la zona se ve en el listado.
- [ ] Crear pedidos de prueba para esos comercios (vía la app cliente o directo en la base) y confirmar en `/admin/pedidos` que dentro del turno correspondiente los pedidos aparecen agrupados por zona, con "Sin zona" al final.
- [ ] Abrir el remito de uno de esos pedidos (`/admin/remito/[id]`) y confirmar que la zona aparece; abrir uno sin zona y confirmar que la línea no aparece.
- [ ] Abrir "Imprimir todos los remitos" (`/admin/remitos`) para el turno de prueba y confirmar lo mismo en la vista de remitos por lote.
- [ ] Revertir/limpiar los datos de prueba que no correspondan a comercios reales, igual que se hizo tras la prueba de WhatsApp.

---

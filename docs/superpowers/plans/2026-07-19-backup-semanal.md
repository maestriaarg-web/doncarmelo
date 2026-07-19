# Backup semanal por email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mandar automáticamente, todos los domingos a la noche, un Excel con puntos de venta, catálogo de productos y pedidos de los últimos 7 días a un email configurable — red de contingencia si Vercel/Supabase fallan.

**Architecture:** Un endpoint HTTP (`/api/backup-semanal`) protegido por un secreto compartido, disparado por un Vercel Cron Job semanal. El endpoint arma el Excel con una función pura (`generarBackupExcel`) y lo manda por mail con Resend. El destino del mail se configura desde una pantalla nueva del admin (`/admin/configuracion`), guardado en una tabla de una sola fila.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, TypeScript, Supabase (Postgres + `@supabase/ssr` + `@supabase/supabase-js`), `exceljs` (nueva dependencia, generación de `.xlsx`), `resend` (ya en `package.json`, hasta ahora sin usar), Vercel Cron.

## Global Constraints

- Sin suite de tests automatizada (decisión ya confirmada para todo el proyecto). Verificación: `npm run build && npm run lint` + prueba manual.
- Migraciones SQL se aplican manualmente por el usuario en el Supabase Dashboard SQL Editor.
- Server Actions devuelven `ActionResult` (`{error: string} | {success: true}`), nunca `throw`.
- `/admin/configuracion` es solo para el rol `admin` — el link de nav ya queda oculto para `empleado` reusando el mismo patrón condicional (`esAdmin`) que las demás secciones admin-only, y `proxy.ts` ya bloquea el render para `empleado` sin cambios adicionales (no está en `RUTAS_PERMITIDAS_EMPLEADO`). La Server Action que escribe la config debe además validar el rol del que llama por su cuenta (mismo patrón que `usuarios/actions.ts`: los Server Actions se invocan por id de acción, no por ruta, así que el proxy no alcanza para protegerlos).
- El endpoint `/api/backup-semanal` valida el header `Authorization: Bearer ${CRON_SECRET}` — Vercel manda ese header automáticamente en las invocaciones de Cron cuando la variable de entorno `CRON_SECRET` está configurada en el proyecto (comportamiento documentado de Vercel, no algo custom).
- Reusar tokens de diseño existentes: `bg-primary`/`hover:bg-primary-hover`, `bg-background`, `text-foreground`, `text-neutral-*`.
- Copy en español.
- `pedidos` del backup se filtran por `creado_en` (últimos 7 días), no por `fecha_entrega`.
- Fuera de alcance (no crear ninguna tarea para esto): restauración automática desde el Excel, alertas si el envío falla, múltiples destinatarios, backup de `excepciones_corte` o de usuarios del admin, migrar de proveedor de hosting/base de datos.

---

### Task 1: Migración + pantalla `/admin/configuracion`

**Files:**
- Create: `supabase/migrations/0005_configuracion.sql`
- Modify: `src/lib/types.ts`
- Create: `src/app/admin/(dashboard)/configuracion/page.tsx`
- Create: `src/app/admin/(dashboard)/configuracion/ConfiguracionForm.tsx`
- Create: `src/app/admin/(dashboard)/configuracion/actions.ts`
- Modify: `src/app/admin/(dashboard)/layout.tsx`

**Interfaces:**
- Produces: `Configuracion` type (`{ id: number; backup_email: string | null }`), tabla `configuracion` con una única fila (`id = 1`) — consumidos por Task 3 (el endpoint lee `backup_email` de esta tabla).

- [ ] **Step 1: Migración — archivo completo**

```sql
-- supabase/migrations/0005_configuracion.sql
-- Tabla de una sola fila para configuración general del sistema. Hoy solo
-- guarda el email de destino del backup semanal; al ser un singleton, una
-- futura configuración nueva se suma como otra columna nullable en vez de
-- necesitar una tabla nueva.
-- Corré esto en Supabase SQL Editor.

create table configuracion (
  id integer primary key default 1,
  backup_email text,
  constraint configuracion_singleton check (id = 1)
);

insert into configuracion (id, backup_email) values (1, null)
on conflict (id) do nothing;

alter table configuracion enable row level security;

create policy "admin_full_access" on configuracion for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
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

export type Configuracion = {
  id: number
  backup_email: string | null
}
```

- [ ] **Step 3: `configuracion/page.tsx` — archivo completo**

```tsx
// src/app/admin/(dashboard)/configuracion/page.tsx
import { createClient } from '@/lib/supabase/server'
import type { Configuracion } from '@/lib/types'
import { ConfiguracionForm } from './ConfiguracionForm'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: configuracion, error } = await supabase
    .from('configuracion')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw new Error(error.message)

  return <ConfiguracionForm configuracion={configuracion as Configuracion} />
}
```

- [ ] **Step 4: `configuracion/ConfiguracionForm.tsx` — archivo completo**

```tsx
// src/app/admin/(dashboard)/configuracion/ConfiguracionForm.tsx
'use client'

import { useState, type FormEvent } from 'react'
import type { Configuracion } from '@/lib/types'
import { actualizarBackupEmail } from './actions'

export function ConfiguracionForm({ configuracion }: { configuracion: Configuracion }) {
  const [backupEmail, setBackupEmail] = useState(configuracion.backup_email ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)
    const result = await actualizarBackupEmail(backupEmail || null)
    if ('error' in result) {
      setError(result.error)
    } else {
      setGuardado(true)
    }
    setGuardando(false)
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-foreground">Configuración</h1>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4"
      >
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {guardado && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Guardado.</p>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Email para el backup semanal
          </label>
          <input
            type="email"
            value={backupEmail}
            onChange={(e) => setBackupEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-base"
          />
          <p className="mt-1 text-sm text-neutral-500">
            Todos los domingos a la noche se manda a esta casilla un Excel con los puntos de
            venta, el catálogo y los pedidos de la semana. Dejalo vacío para no mandar nada.
          </p>
        </div>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-primary px-4 py-2.5 text-base font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: `configuracion/actions.ts` — archivo completo**

```ts
// src/app/admin/(dashboard)/configuracion/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { obtenerRolActual } from '@/lib/admin/auth'
import type { ActionResult } from '@/lib/types'

// Server Actions se invocan por id de acción, no por ruta — proxy.ts protege
// el RENDER de /admin/configuracion, pero no la ejecución de esta función si
// alguien arma el request a mano. Por eso valida el rol del que llama por su
// cuenta (mismo patrón que src/app/admin/(dashboard)/usuarios/actions.ts).
async function exigirAdmin(): Promise<{ userId: string } | { error: string }> {
  const actual = await obtenerRolActual()
  if (!actual || actual.rol !== 'admin') return { error: 'No autorizado.' }
  return { userId: actual.userId }
}

export async function actualizarBackupEmail(email: string | null): Promise<ActionResult> {
  const auth = await exigirAdmin()
  if ('error' in auth) return auth

  const supabase = await createClient()
  const { error } = await supabase.from('configuracion').update({ backup_email: email }).eq('id', 1)

  if (error) return { error: error.message }
  revalidatePath('/admin/configuracion')
  return { success: true }
}
```

- [ ] **Step 6: `layout.tsx` — archivo completo**

```tsx
// src/app/admin/(dashboard)/layout.tsx
import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'
import { obtenerRolActual } from '@/lib/admin/auth'
import { signOut } from '../login/actions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sesion = await obtenerRolActual()
  const esAdmin = sesion?.rol !== 'empleado'

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-6">
          <BrandMark />
          <nav className="flex gap-4 text-sm font-medium text-neutral-700">
            <Link href="/admin/pedidos">Pedidos</Link>
            {esAdmin && (
              <>
                <Link href="/admin/productos">Productos</Link>
                <Link href="/admin/puntos-venta">Puntos de venta</Link>
                <Link href="/admin/excepciones">Excepciones de corte</Link>
                <Link href="/admin/usuarios">Usuarios</Link>
                <Link href="/admin/configuracion">Configuración</Link>
              </>
            )}
          </nav>
        </div>
        <form action={signOut}>
          <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-900">
            Salir
          </button>
        </form>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 7: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0005_configuracion.sql src/lib/types.ts "src/app/admin/(dashboard)/configuracion" "src/app/admin/(dashboard)/layout.tsx"
git commit -m "Add configuracion table and /admin/configuracion screen for the backup email"
```

**Nota para quien ejecute este plan:** después de este task, recordarle al usuario que corra la migración `0005_configuracion.sql` en el Supabase Dashboard antes de la prueba manual final (Task 4).

---

### Task 2: Generador de Excel (función pura)

**Files:**
- Create: `src/lib/backup/generarExcel.ts`
- Modify: `package.json` (nueva dependencia `exceljs`)

**Interfaces:**
- Produces: `generarBackupExcel(input: { puntosVenta: PuntoVentaBackupRow[]; productos: ProductoBackupRow[]; pedidos: PedidoBackupRow[] }): Promise<Buffer>`, y los tipos `PuntoVentaBackupRow`, `ProductoBackupRow`, `PedidoBackupRow` — consumidos por Task 3.

- [ ] **Step 1: Instalar dependencia**

Run: `npm install exceljs`
Expected: se agrega `exceljs` a `dependencies` en `package.json` (trae sus propios tipos TypeScript, no hace falta `@types/exceljs`).

- [ ] **Step 2: Módulo completo**

```ts
// src/lib/backup/generarExcel.ts
import ExcelJS from 'exceljs'

export type PuntoVentaBackupRow = {
  nombre: string
  celular: string
  direccion: string | null
  zona: string | null
  contacto: string | null
  etiqueta_default: string
  pedido_minimo: number | null
  activo: boolean
}

export type ProductoBackupRow = {
  nombre: string
  categoria: string
  unidad: string
  precio_sugerido: number | null
  congelado: boolean
  disponible: boolean
  activo: boolean
}

export type PedidoBackupRow = {
  fecha_entrega: string
  turno_reparto: string
  punto_venta: string
  estado: string
  producto: string
  unidad: string
  cantidad: number
}

export async function generarBackupExcel({
  puntosVenta,
  productos,
  pedidos,
}: {
  puntosVenta: PuntoVentaBackupRow[]
  productos: ProductoBackupRow[]
  pedidos: PedidoBackupRow[]
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  const hojaPuntosVenta = workbook.addWorksheet('Puntos de venta')
  hojaPuntosVenta.columns = [
    { header: 'Nombre', key: 'nombre', width: 28 },
    { header: 'Celular', key: 'celular', width: 16 },
    { header: 'Dirección', key: 'direccion', width: 28 },
    { header: 'Zona', key: 'zona', width: 16 },
    { header: 'Contacto', key: 'contacto', width: 20 },
    { header: 'Etiqueta', key: 'etiqueta_default', width: 14 },
    { header: 'Pedido mínimo', key: 'pedido_minimo', width: 14 },
    { header: 'Activo', key: 'activo', width: 10 },
  ]
  hojaPuntosVenta.addRows(puntosVenta)

  const hojaProductos = workbook.addWorksheet('Productos')
  hojaProductos.columns = [
    { header: 'Nombre', key: 'nombre', width: 28 },
    { header: 'Categoría', key: 'categoria', width: 18 },
    { header: 'Unidad', key: 'unidad', width: 12 },
    { header: 'Precio sugerido', key: 'precio_sugerido', width: 16 },
    { header: 'Congelado', key: 'congelado', width: 12 },
    { header: 'Disponible', key: 'disponible', width: 12 },
    { header: 'Activo', key: 'activo', width: 10 },
  ]
  hojaProductos.addRows(productos)

  const hojaPedidos = workbook.addWorksheet('Pedidos (últimos 7 días)')
  hojaPedidos.columns = [
    { header: 'Fecha de entrega', key: 'fecha_entrega', width: 16 },
    { header: 'Turno', key: 'turno_reparto', width: 10 },
    { header: 'Punto de venta', key: 'punto_venta', width: 28 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Producto', key: 'producto', width: 24 },
    { header: 'Cantidad', key: 'cantidad', width: 12 },
    { header: 'Unidad', key: 'unidad', width: 10 },
  ]
  hojaPedidos.addRows(pedidos)

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: builds exitosamente (nada consume `generarBackupExcel` todavía).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/backup/generarExcel.ts
git commit -m "Add generarBackupExcel: pure function building the 3-sheet backup workbook"
```

---

### Task 3: Endpoint `/api/backup-semanal` + Resend + Vercel Cron

**Files:**
- Create: `src/app/api/backup-semanal/route.ts`
- Create: `vercel.json`
- Modify: `.env.local`

**Interfaces:**
- Consumes: `generarBackupExcel` y sus tipos (Task 2); tabla `configuracion` (Task 1).

- [ ] **Step 1: Endpoint — archivo completo**

```ts
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
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
```

- [ ] **Step 2: `vercel.json` — archivo completo**

```json
{
  "crons": [
    {
      "path": "/api/backup-semanal",
      "schedule": "0 2 * * 1"
    }
  ]
}
```

`0 2 * * 1` = 02:00 UTC los lunes = 23:00 hora Argentina los domingos (Argentina no tiene horario de verano, así que esta conversión es estable todo el año).

- [ ] **Step 3: Variables de entorno — agregar a `.env.local`**

Agregar (sin pisar lo que ya existe en el archivo):

```
# Cron de backup semanal
CRON_SECRET=<generar un valor random largo, ej. con `openssl rand -hex 32`>
RESEND_FROM_EMAIL=onboarding@resend.dev
```

`RESEND_API_KEY` ya está reservada en el archivo (vacía) — hay que completarla con una key real generada en resend.com. Con `onboarding@resend.dev` como remitente (el dominio de prueba de Resend), los mails solo se entregan a la casilla asociada a la cuenta de Resend hasta que se verifique un dominio propio — suficiente para probar, no para producción con el email real del cliente si no coincide con esa cuenta.

- [ ] **Step 4: Build check**

Run: `npm run build && npm run lint`
Expected: ambos sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/backup-semanal/route.ts vercel.json
git commit -m "Add /api/backup-semanal endpoint, Vercel Cron config, and CRON_SECRET protection"
```

**Nota para quien ejecute este plan:** `.env.local` no se commitea (está en `.gitignore`), así que el Step 3 no genera un commit — es solo para que las pruebas manuales locales/en Vercel tengan las variables necesarias. Recordarle al usuario agregar `CRON_SECRET`, `RESEND_API_KEY` y `RESEND_FROM_EMAIL` también como variables de entorno de producción en Vercel (mismo mecanismo ya usado para las variables de Twilio).

---

### Task 4: Smoke test end-to-end + deploy

No es un task de código — es la verificación manual final, ejecutada directamente (sin subagente).

- [ ] Confirmar con el usuario que ya corrió la migración `0005_configuracion.sql` en el Supabase Dashboard.
- [ ] Generar y cargar `CRON_SECRET` (valor real) y `RESEND_API_KEY` (key real de Resend) en Vercel (producción) y en `.env.local` (para la prueba manual).
- [ ] `git push` y deploy a producción.
- [ ] En `/admin/configuracion`, cargar un email de prueba (el asociado a la cuenta de Resend, si se sigue usando `onboarding@resend.dev` como remitente) y guardar.
- [ ] Invocar el endpoint a mano con el `CRON_SECRET` correcto (`curl -H "Authorization: Bearer $CRON_SECRET" https://doncarmelo.vercel.app/api/backup-semanal`) y confirmar respuesta `{"success":true}`.
- [ ] Confirmar que el mail llegó, con el Excel adjunto, y que las 3 hojas tienen los datos esperados (puntos de venta, productos, pedidos de los últimos 7 días).
- [ ] Probar el caso sin `Authorization` o con un valor incorrecto — debe responder 401 y no mandar nada.
- [ ] Vaciar el campo `backup_email` en `/admin/configuracion`, volver a invocar el endpoint, y confirmar que responde `{"skipped":true, ...}` sin mandar mail — después volver a cargar el email real.
- [ ] Confirmar que el link "Configuración" no aparece para el rol `empleado` (probar con la cuenta de prueba) y que intentar invocar `actualizarBackupEmail` como empleado (si se puede forzar) devuelve `{"error":"No autorizado."}`.

---

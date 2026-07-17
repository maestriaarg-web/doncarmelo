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

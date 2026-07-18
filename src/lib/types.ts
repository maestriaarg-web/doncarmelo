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

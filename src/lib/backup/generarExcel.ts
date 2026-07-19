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

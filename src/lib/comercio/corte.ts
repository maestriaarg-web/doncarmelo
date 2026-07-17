const TIMEZONE = 'America/Argentina/Buenos_Aires'
const HORA_CORTE_DEFAULT = '09:00'
const HORA_CIERRE_TARDE = '20:00'

export type ResultadoCorte = {
  fechaEntrega: string // YYYY-MM-DD
  turno: 'manana' | 'tarde'
  fueraDeHorario: boolean
}

function formatearFechaArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(fecha)
}

function formatearHoraArgentina(fecha: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha)
}

function sumarUnDia(fechaYYYYMMDD: string): string {
  const [y, m, d] = fechaYYYYMMDD.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

export function obtenerFechaHoyYManana(ahora: Date): { hoy: string; manana: string } {
  const hoy = formatearFechaArgentina(ahora)
  return { hoy, manana: sumarUnDia(hoy) }
}

/**
 * Calcula el turno de reparto. `excepciones` es un mapa fecha (YYYY-MM-DD) -> hora_corte (HH:mm)
 * para las fechas relevantes (hoy y mañana) según lo que haya en `excepciones_corte`.
 */
export function calcularTurno(
  eleccion: 'hoy' | 'manana',
  ahora: Date,
  excepciones: Record<string, string>
): ResultadoCorte {
  const { hoy, manana } = obtenerFechaHoyYManana(ahora)

  if (eleccion === 'manana') {
    return { fechaEntrega: manana, turno: 'manana', fueraDeHorario: false }
  }

  const horaActual = formatearHoraArgentina(ahora)
  const horaCorteHoy = excepciones[hoy] ?? HORA_CORTE_DEFAULT

  if (horaActual < horaCorteHoy) {
    return { fechaEntrega: hoy, turno: 'manana', fueraDeHorario: false }
  }
  if (horaActual < HORA_CIERRE_TARDE) {
    return { fechaEntrega: hoy, turno: 'tarde', fueraDeHorario: true }
  }
  // Ya cerró todo reparto de hoy: se empuja a mañana.
  return { fechaEntrega: manana, turno: 'manana', fueraDeHorario: false }
}

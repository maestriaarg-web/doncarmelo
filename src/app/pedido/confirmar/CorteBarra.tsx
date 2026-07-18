'use client'

import { HORA_CIERRE_TARDE } from '@/lib/comercio/corte'

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function CorteBarra({
  horaCorteHoy,
  horaActual,
}: {
  horaCorteHoy: string
  horaActual: string
}) {
  const minutosEnDia = 24 * 60
  const pctCorte = (horaAMinutos(horaCorteHoy) / minutosEnDia) * 100
  const pctCierre = (horaAMinutos(HORA_CIERRE_TARDE) / minutosEnDia) * 100
  const pctActual = (horaAMinutos(horaActual) / minutosEnDia) * 100

  return (
    <div>
      <div className="mb-2 text-sm font-medium text-neutral-700">
        Corte de pedidos: {horaCorteHoy}
      </div>
      <div
        className="relative h-4 overflow-hidden rounded-lg"
        style={{
          background: `linear-gradient(to right,
            #16a34a 0%, #16a34a ${pctCorte}%,
            #f59e0b ${pctCorte}%, #f59e0b ${pctCierre}%,
            #dc2626 ${pctCierre}%, #dc2626 100%)`,
        }}
      >
        <div
          className="absolute top-[-6px] h-7 w-0.5 bg-foreground"
          style={{ left: `${pctActual}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-neutral-400">
        <span>00:00</span>
        <span>{horaCorteHoy}</span>
        <span>{HORA_CIERRE_TARDE}</span>
        <span>24:00</span>
      </div>
    </div>
  )
}

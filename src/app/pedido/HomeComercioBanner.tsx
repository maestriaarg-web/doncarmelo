'use client'

import { useState } from 'react'

const HORARIO_LINEAS = [
  'PEDIDOS HASTA LAS 9AM SE REPARTEN DE 9 A 12.30',
  'PEDIDOS DESPUÉS DE LAS 9AM, SE REPARTEN DE 17 A 20.',
  'SÁBADOS POR LA TARDE NO HAY REPARTO',
]

/**
 * Acepta los formatos comunes de link de YouTube (watch?v=, youtu.be/,
 * embed/ ya armado) y devuelve la URL de embed, o null si no matchea
 * ninguno — en ese caso el link de "Ver video" simplemente no se muestra.
 */
export function extraerYoutubeEmbedUrl(url: string): string | null {
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`

  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`

  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return `https://www.youtube.com/embed/${embedMatch[1]}`

  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`

  const liveMatch = url.match(/\/live\/([a-zA-Z0-9_-]{11})/)
  if (liveMatch) return `https://www.youtube.com/embed/${liveMatch[1]}`

  return null
}

export function HomeComercioBanner({
  listaPreciosUrl,
  videoEmbalajeUrl,
}: {
  listaPreciosUrl: string | null
  videoEmbalajeUrl: string | null
}) {
  const [mostrandoVideo, setMostrandoVideo] = useState(false)
  const embedUrl = videoEmbalajeUrl ? extraerYoutubeEmbedUrl(videoEmbalajeUrl) : null

  return (
    <div className="space-y-2 border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="text-center text-sm font-bold leading-snug text-amber-900 sm:text-base">
        {HORARIO_LINEAS.map((linea) => (
          <p key={linea}>{linea}</p>
        ))}
      </div>

      {(embedUrl || listaPreciosUrl) && (
        <div className="flex flex-wrap justify-center gap-3 text-sm">
          {embedUrl && (
            <button
              onClick={() => setMostrandoVideo((v) => !v)}
              className="font-medium text-neutral-600 underline"
            >
              {mostrandoVideo ? 'Ocultar video de embalaje' : 'Ver video de embalaje'}
            </button>
          )}
          {listaPreciosUrl && (
            <a
              href={listaPreciosUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-600 underline"
            >
              Descargar lista de precios
            </a>
          )}
        </div>
      )}

      {mostrandoVideo && embedUrl && (
        <div className="aspect-video w-full overflow-hidden rounded-md">
          <iframe
            src={embedUrl}
            title="Video de embalaje"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}
    </div>
  )
}

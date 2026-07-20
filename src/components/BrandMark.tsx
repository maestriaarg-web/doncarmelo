export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" className="h-7 w-7 flex-shrink-0" />
      <span className="font-semibold text-foreground">Don Carmelo</span>
    </span>
  )
}

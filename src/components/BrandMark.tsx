export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="h-5 w-5 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />
      <span className="font-semibold text-foreground">Don Carmelo</span>
    </span>
  )
}

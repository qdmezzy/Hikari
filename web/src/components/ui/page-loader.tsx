import { cn } from "@/lib/utils"

type PageLoaderProps = {
  label?: string
  fullScreen?: boolean
  className?: string
}

export function PageLoader({
  label = "Loading...",
  fullScreen = false,
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "min-h-screen bg-background" : "absolute inset-0",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:-0.2s]" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/80" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/60 [animation-delay:0.2s]" />
        </div>
        <p className="text-sm font-medium text-white/62">{label}</p>
      </div>
    </div>
  )
}

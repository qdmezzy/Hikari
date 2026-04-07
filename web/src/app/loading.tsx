import { Sparkles } from "lucide-react"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5" />
      
      {/* Floating crystals with CSS animations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float opacity-30"
            style={{
              left: `${20 + i * 15}%`,
              top: `${30 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${3 + i * 0.5}s`,
            }}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 text-accent/50"
              fill="currentColor"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
        ))}
      </div>

      {/* Main loading content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo with pulse */}
        <div className="relative animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg shadow-accent/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-accent/30 blur-xl animate-pulse" />
        </div>

        {/* Loading text */}
        <p className="mt-6 text-foreground font-medium animate-pulse">
          Loading...
        </p>

        {/* Progress bar */}
        <div className="mt-4 w-32 h-1 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-accent to-primary rounded-full animate-shimmer"
            style={{ width: "50%" }}
          />
        </div>
      </div>
    </div>
  )
}

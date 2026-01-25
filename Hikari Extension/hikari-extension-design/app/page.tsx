import { ExtensionPopup } from "@/components/extension-popup"

export default function Page() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground mb-1">Hikari Extension</h1>
          <p className="text-sm text-muted-foreground">Use the nav icons to switch views</p>
        </div>
        <ExtensionPopup />
      </div>
    </main>
  )
}

import { Checker } from "@/components/checker"

export default function Home() {
  return (
    <div className="flex min-h-screen justify-center bg-background px-4 py-12 sm:py-20">
      <main className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">OpenMoliere</h1>
          <p className="text-sm text-muted-foreground">
            Dual-engine spelling, grammar, and style checker
          </p>
        </div>
        <Checker />
      </main>
    </div>
  )
}

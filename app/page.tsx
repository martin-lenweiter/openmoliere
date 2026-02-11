"use client"

import { Checker } from "@/components/checker"
import { useI18n, UI_LANGUAGES } from "@/lib/i18n"
import { Globe } from "lucide-react"

export default function Home() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="flex min-h-screen justify-center bg-background px-4 py-12 sm:py-20">
      <main className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">OpenMoliere</h1>
            <div className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as typeof locale)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {UI_LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t.siteDescription}
          </p>
        </div>
        <Checker />
      </main>
    </div>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { label: "Proofreader", href: "/proofread" },
  { label: "Prompt Engineer", href: "/prompt-engineer" },
]

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen justify-center bg-background px-4 py-12 sm:py-20">
      <main className="w-full max-w-3xl">
        <div className="mb-8 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">OpenMoliere</h1>
          <nav className="flex border-b border-border">
            {TABS.map((tab, i) => {
              const isActive = pathname === tab.href
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`pb-2 text-sm font-medium transition-colors ${i < TABS.length - 1 ? "pr-4" : ""} ${
                    isActive
                      ? "border-b-2 border-foreground text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </nav>
        </div>
        {children}
      </main>
    </div>
  )
}

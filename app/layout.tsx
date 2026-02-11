import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { I18nProvider } from "@/lib/i18n"
import "./globals.css"

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "OpenMoliere",
  description: "AI-powered and rule-based spelling, grammar, and style checker",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} font-sans antialiased`}>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  )
}

"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

export type UILocale = "en" | "nl" | "fr" | "de" | "es"

export const UI_LANGUAGES: { value: UILocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
]

const translations = {
  en: {
    siteDescription: "AI-powered and rule-based spelling, grammar, and style checker",
    placeholder: "Paste your text here to check for spelling, grammar, and style errors...",
    check: "Check",
    checking: "Checking...",
    copy: "Copy",
    copied: "Copied",
    correctedText: "Corrected Text",
    analyzingErrors: "Analyzing errors...",
    noIssues: "No issues found. Your text looks great.",
    changes: "Changes",
    high: "High",
    uncertain: "Uncertain",
    autoDetect: "Auto-detect",
    spelling: "spelling",
    grammar: "grammar",
    style: "style",
  },
  nl: {
    siteDescription: "AI-gestuurde en regelgebaseerde spelling-, grammatica- en stijlcontrole",
    placeholder: "Plak hier uw tekst om te controleren op spelling-, grammatica- en stijlfouten...",
    check: "Controleren",
    checking: "Controleren...",
    copy: "Kopiëren",
    copied: "Gekopieerd",
    correctedText: "Gecorrigeerde tekst",
    analyzingErrors: "Fouten analyseren...",
    noIssues: "Geen problemen gevonden. Uw tekst ziet er goed uit.",
    changes: "Wijzigingen",
    high: "Hoog",
    uncertain: "Onzeker",
    autoDetect: "Automatisch detecteren",
    spelling: "spelling",
    grammar: "grammatica",
    style: "stijl",
  },
  fr: {
    siteDescription: "Correcteur d'orthographe, de grammaire et de style basé sur l'IA et des règles",
    placeholder: "Collez votre texte ici pour vérifier l'orthographe, la grammaire et le style...",
    check: "Vérifier",
    checking: "Vérification...",
    copy: "Copier",
    copied: "Copié",
    correctedText: "Texte corrigé",
    analyzingErrors: "Analyse des erreurs...",
    noIssues: "Aucun problème trouvé. Votre texte est impeccable.",
    changes: "Corrections",
    high: "Élevée",
    uncertain: "Incertaine",
    autoDetect: "Détection automatique",
    spelling: "orthographe",
    grammar: "grammaire",
    style: "style",
  },
  de: {
    siteDescription: "KI-gestützte und regelbasierte Rechtschreib-, Grammatik- und Stilprüfung",
    placeholder: "Fügen Sie hier Ihren Text ein, um Rechtschreibung, Grammatik und Stil zu prüfen...",
    check: "Prüfen",
    checking: "Prüfung...",
    copy: "Kopieren",
    copied: "Kopiert",
    correctedText: "Korrigierter Text",
    analyzingErrors: "Fehler werden analysiert...",
    noIssues: "Keine Probleme gefunden. Ihr Text sieht gut aus.",
    changes: "Änderungen",
    high: "Hoch",
    uncertain: "Unsicher",
    autoDetect: "Automatisch erkennen",
    spelling: "Rechtschreibung",
    grammar: "Grammatik",
    style: "Stil",
  },
  es: {
    siteDescription: "Corrector ortográfico, gramatical y de estilo basado en IA y reglas",
    placeholder: "Pegue su texto aquí para verificar la ortografía, gramática y estilo...",
    check: "Verificar",
    checking: "Verificando...",
    copy: "Copiar",
    copied: "Copiado",
    correctedText: "Texto corregido",
    analyzingErrors: "Analizando errores...",
    noIssues: "No se encontraron problemas. Su texto se ve perfecto.",
    changes: "Cambios",
    high: "Alta",
    uncertain: "Incierta",
    autoDetect: "Detección automática",
    spelling: "ortografía",
    grammar: "gramática",
    style: "estilo",
  },
} as const

export type Translations = { [K in keyof (typeof translations)["en"]]: string }

type I18nContextType = {
  locale: UILocale
  setLocale: (locale: UILocale) => void
  t: Translations
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: translations.en,
})

const STORAGE_KEY = "openmoliere-ui-lang"

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UILocale>("en")

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as UILocale | null
    if (saved && saved in translations) {
      setLocaleState(saved)
      document.documentElement.lang = saved
    }
  }, [])

  const setLocale = useCallback((newLocale: UILocale) => {
    setLocaleState(newLocale)
    localStorage.setItem(STORAGE_KEY, newLocale)
    document.documentElement.lang = newLocale
  }, [])

  return (
    <I18nContext.Provider value={{ locale, t: translations[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

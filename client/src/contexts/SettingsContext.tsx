import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type AppSettings = {
  animationsEnabled: boolean
  previewRowLimit: string
  recentDatasetsCount: string
  confirmBeforeDelete: boolean
}

interface SettingsContextType {
  settings: AppSettings
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
  resetSettings: () => void
}

const STORAGE_KEY = 'healthlens-settings'

const defaultSettings: AppSettings = {
  animationsEnabled: true,
  previewRowLimit: '5000',
  recentDatasetsCount: '5',
  confirmBeforeDelete: true,
}

const loadSettings = (): AppSettings => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return defaultSettings
    return { ...defaultSettings, ...(JSON.parse(saved) as Partial<AppSettings>) }
  } catch {
    return defaultSettings
  }
}

const persistSettings = (settings: AppSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

const applyBodyClasses = (settings: AppSettings) => {
  // Animations
  if (!settings.animationsEnabled) {
    document.body.classList.add('no-animations')
  } else {
    document.body.classList.remove('no-animations')
  }
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const initial = loadSettings()
    applyBodyClasses(initial)
    return initial
  })

  useEffect(() => {
    applyBodyClasses(settings)
    persistSettings(settings)
  }, [settings])

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings)
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within SettingsProvider')
  return context
}

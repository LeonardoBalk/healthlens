import { useEffect, useState } from 'react'
import { Bell, Globe, Monitor, Palette, Shield, Trash2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import styles from './SettingsPage.module.scss'

type ToastState = {
  message: string
  type: 'success' | 'error'
}

const STORAGE_KEY = 'healthlens-settings'

type AppSettings = {
  language: string
  notifications: boolean
  compactMode: boolean
  animationsEnabled: boolean
  autoSaveInterval: string
}

const defaultSettings: AppSettings = {
  language: 'pt-BR',
  notifications: true,
  compactMode: false,
  animationsEnabled: true,
  autoSaveInterval: '5',
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

const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      saveSettings(next)
      return next
    })
    setToast({ message: 'Configuração salva.', type: 'success' })
  }

  const handleClearLocalData = () => {
    const keysToKeep = ['healthlens-theme']
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && !keysToKeep.includes(key)) {
        keys.push(key)
      }
    }
    keys.forEach((key) => localStorage.removeItem(key))
    setSettings(defaultSettings)
    setToast({ message: 'Dados locais removidos.', type: 'success' })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Configurações</h1>
        <p className={styles.subtitle}>
          Personalize a experiência do HealthLens conforme sua preferência.
        </p>
      </header>

      {/* Aparência */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <Palette size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Aparência</h2>
            <p className={styles.sectionDescription}>Tema, animações e layout da interface.</p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Tema escuro</span>
            <span className={styles.settingHint}>
              Alterna entre o modo claro e escuro da interface.
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${theme === 'dark' ? styles.toggleActive : ''}`}
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Alternar tema escuro"
          />
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Animações</span>
            <span className={styles.settingHint}>
              Desative para reduzir movimento na interface.
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.animationsEnabled ? styles.toggleActive : ''}`}
            onClick={() => updateSetting('animationsEnabled', !settings.animationsEnabled)}
            role="switch"
            aria-checked={settings.animationsEnabled}
            aria-label="Alternar animações"
          />
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Modo compacto</span>
            <span className={styles.settingHint}>
              Reduz espaçamentos para mostrar mais conteúdo.
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.compactMode ? styles.toggleActive : ''}`}
            onClick={() => updateSetting('compactMode', !settings.compactMode)}
            role="switch"
            aria-checked={settings.compactMode}
            aria-label="Alternar modo compacto"
          />
        </div>
      </section>

      {/* Geral */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <Globe size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Geral</h2>
            <p className={styles.sectionDescription}>Idioma e salvamento automático.</p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Idioma</span>
            <span className={styles.settingHint}>Define o idioma da interface.</span>
          </div>
          <select
            className={styles.select}
            value={settings.language}
            onChange={(e) => updateSetting('language', e.target.value)}
          >
            <option value="pt-BR">Português (BR)</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Intervalo de auto-save</span>
            <span className={styles.settingHint}>
              Frequência em que os dados são salvos localmente.
            </span>
          </div>
          <select
            className={styles.select}
            value={settings.autoSaveInterval}
            onChange={(e) => updateSetting('autoSaveInterval', e.target.value)}
          >
            <option value="1">A cada 1 min</option>
            <option value="5">A cada 5 min</option>
            <option value="15">A cada 15 min</option>
            <option value="off">Desativado</option>
          </select>
        </div>
      </section>

      {/* Notificações */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <Bell size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Notificações</h2>
            <p className={styles.sectionDescription}>Controle alertas e avisos do sistema.</p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Notificações do sistema</span>
            <span className={styles.settingHint}>
              Receba alertas sobre uploads e análises concluídas.
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.notifications ? styles.toggleActive : ''}`}
            onClick={() => updateSetting('notifications', !settings.notifications)}
            role="switch"
            aria-checked={settings.notifications}
            aria-label="Alternar notificações"
          />
        </div>
      </section>

      {/* Privacidade */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <Shield size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Privacidade</h2>
            <p className={styles.sectionDescription}>Gerencie dados armazenados localmente.</p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Armazenamento local</span>
            <span className={styles.settingHint}>
              Os dados de sessão, datasets em cache e preferências são armazenados apenas no seu
              navegador.
            </span>
          </div>
          <span className={styles.settingLabel}>
            <Monitor size={16} style={{ opacity: 0.5 }} />
          </span>
        </div>
      </section>

      {/* Zona de perigo */}
      <section className={`${styles.section} ${styles.dangerSection}`}>
        <div className={`${styles.sectionHeader} ${styles.dangerHeader}`}>
          <span className={`${styles.sectionIcon} ${styles.dangerIcon}`}>
            <Trash2 size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Zona de perigo</h2>
            <p className={styles.sectionDescription}>Ações destrutivas e irreversíveis.</p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Limpar dados locais</span>
            <span className={styles.settingHint}>
              Remove todos os datasets em cache e configurações (exceto tema). Esta ação não pode
              ser desfeita.
            </span>
          </div>
          <button type="button" className={styles.dangerButton} onClick={handleClearLocalData}>
            <Trash2 size={15} />
            <span>Limpar</span>
          </button>
        </div>
      </section>

      {toast && (
        <div
          className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Database, Palette, Trash2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings } from '@/contexts/SettingsContext'
import styles from './SettingsPage.module.scss'

type ToastState = {
  message: string
  type: 'success' | 'error'
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const { settings, updateSetting, resetSettings } = useSettings()
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleToggle = <K extends 'animationsEnabled' | 'confirmBeforeDelete'>(key: K) => {
    updateSetting(key, !settings[key])
    setToast({ message: 'Configuração salva.', type: 'success' })
  }

  const handleSelect = <K extends 'recentDatasetsCount'>(key: K, value: string) => {
    updateSetting(key, value as (typeof settings)[K])
    setToast({ message: 'Configuração salva.', type: 'success' })
  }

  const handleClearLocalData = () => {
    const keysToKeep = ['healthlens-theme', 'healthlens-settings']
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && !keysToKeep.includes(key)) {
        keys.push(key)
      }
    }
    keys.forEach((key) => localStorage.removeItem(key))
    setToast({ message: 'Dados locais removidos.', type: 'success' })
  }

  const handleResetSettings = () => {
    resetSettings()
    setToast({ message: 'Configurações restauradas ao padrão.', type: 'success' })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={`gradient-text ${styles.title}`}>Configurações</h1>
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
            <p className={styles.sectionDescription}>Tema e animações da interface.</p>
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
              Desative para reduzir movimento na interface. Todas as transições e animações serão
              removidas.
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.animationsEnabled ? styles.toggleActive : ''}`}
            onClick={() => handleToggle('animationsEnabled')}
            role="switch"
            aria-checked={settings.animationsEnabled}
            aria-label="Alternar animações"
          />
        </div>
      </section>

      {/* Datasets */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <Database size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Datasets</h2>
            <p className={styles.sectionDescription}>Limites de preview e exclusão de dados.</p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Datasets recentes no painel</span>
            <span className={styles.settingHint}>
              Quantidade de datasets exibidos na tela inicial do Painel Epidemiológico.
            </span>
          </div>
          <select
            className={styles.select}
            value={settings.recentDatasetsCount}
            onChange={(e) => handleSelect('recentDatasetsCount', e.target.value)}
          >
            <option value="3">3 datasets</option>
            <option value="5">5 datasets</option>
            <option value="10">10 datasets</option>
            <option value="all">Todos</option>
          </select>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Confirmar antes de excluir</span>
            <span className={styles.settingHint}>
              Exibe um diálogo de confirmação antes de excluir permanentemente um dataset.
            </span>
          </div>
          <button
            type="button"
            className={`${styles.toggle} ${settings.confirmBeforeDelete ? styles.toggleActive : ''}`}
            onClick={() => handleToggle('confirmBeforeDelete')}
            role="switch"
            aria-checked={settings.confirmBeforeDelete}
            aria-label="Alternar confirmação de exclusão"
          />
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
              Remove todos os datasets em cache (exceto tema e configurações). Esta ação não pode
              ser desfeita.
            </span>
          </div>
          <button type="button" className={styles.dangerButton} onClick={handleClearLocalData}>
            <Trash2 size={15} />
            <span>Limpar</span>
          </button>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Restaurar padrões</span>
            <span className={styles.settingHint}>
              Redefine todas as configurações desta página para os valores originais.
            </span>
          </div>
          <button type="button" className={styles.dangerButton} onClick={handleResetSettings}>
            <Trash2 size={15} />
            <span>Restaurar</span>
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

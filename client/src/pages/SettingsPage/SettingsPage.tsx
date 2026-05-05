import { useEffect, useState } from 'react'
import { Bell, Database, Monitor, Palette, Save, Shield, Trash2 } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useSettings, type ChartColorPreset } from '@/contexts/SettingsContext'
import styles from './SettingsPage.module.scss'

type ToastState = {
  message: string
  type: 'success' | 'error'
}

const COLOR_PRESETS: { value: ChartColorPreset; label: string; hex: string }[] = [
  { value: 'rose', label: 'Rosa', hex: '#ff2d55' },
  { value: 'blue', label: 'Azul', hex: '#0a84ff' },
  { value: 'emerald', label: 'Verde', hex: '#30d158' },
  { value: 'amber', label: 'Âmbar', hex: '#ff9f0a' },
  { value: 'violet', label: 'Violeta', hex: '#af52de' },
]

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()
  const { settings, updateSetting, resetSettings } = useSettings()
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleToggle = <K extends 'notifications' | 'animationsEnabled' | 'confirmBeforeDelete'>(
    key: K
  ) => {
    updateSetting(key, !settings[key])
    setToast({ message: 'Configuração salva.', type: 'success' })
  }

  const handleSelect = <
    K extends 'autoSaveInterval' | 'previewRowLimit' | 'chartColorPreset' | 'recentDatasetsCount',
  >(
    key: K,
    value: string
  ) => {
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
            <p className={styles.sectionDescription}>Tema, animações e cores dos gráficos.</p>
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

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Cor de destaque dos gráficos</span>
            <span className={styles.settingHint}>
              Define a cor primária usada nas barras, linhas e destaques dos gráficos.
            </span>
          </div>
          <div className={styles.colorPresets}>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`${styles.colorSwatch} ${settings.chartColorPreset === preset.value ? styles.colorSwatchActive : ''}`}
                style={{ '--swatch-color': preset.hex } as React.CSSProperties}
                onClick={() => handleSelect('chartColorPreset', preset.value)}
                title={preset.label}
                aria-label={`Cor ${preset.label}`}
              />
            ))}
          </div>
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
            <p className={styles.sectionDescription}>
              Limites de preview, painel e exclusão de dados.
            </p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Limite de linhas para preview</span>
            <span className={styles.settingHint}>
              Número máximo de linhas carregadas ao pré-visualizar um dataset. Valores altos podem
              deixar o navegador mais lento.
            </span>
          </div>
          <select
            className={styles.select}
            value={settings.previewRowLimit}
            onChange={(e) => handleSelect('previewRowLimit', e.target.value)}
          >
            <option value="1000">1.000 linhas</option>
            <option value="2500">2.500 linhas</option>
            <option value="5000">5.000 linhas</option>
            <option value="10000">10.000 linhas</option>
          </select>
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

      {/* Salvamento */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>
            <Save size={20} />
          </span>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Salvamento</h2>
            <p className={styles.sectionDescription}>Controle o salvamento automático de dados.</p>
          </div>
        </div>

        <div className={styles.settingRow}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Intervalo de auto-save</span>
            <span className={styles.settingHint}>
              Frequência em que os dados de sessão são salvos localmente no navegador.
            </span>
          </div>
          <select
            className={styles.select}
            value={settings.autoSaveInterval}
            onChange={(e) => handleSelect('autoSaveInterval', e.target.value)}
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
            onClick={() => handleToggle('notifications')}
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

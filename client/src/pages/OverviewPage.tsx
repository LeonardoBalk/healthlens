import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart2,
  CalendarRange,
  Database,
  Download,
  FileText,
  RefreshCcw,
} from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Button } from '@/components/ui/Button/Button'
import { useDatasets } from '@/contexts/DatasetContext'
import { useSettings } from '@/contexts/SettingsContext'
import datasetStyles from './DatasetsPage/DatasetsPage.module.scss'
import styles from './OverviewPage.module.scss'

const INTEGER_FORMATTER = new Intl.NumberFormat('pt-BR')
const DECIMAL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const formatInteger = (value: number) => INTEGER_FORMATTER.format(Math.round(value))
const formatDecimal = (value: number) => DECIMAL_FORMATTER.format(value)

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return 'data indisponível'
  return parsed.toLocaleDateString('pt-BR')
}

const QUICK_NAV = [
  {
    key: 'charts',
    path: '/datasets/charts',
    icon: BarChart2,
    label: 'Gráficos',
    hint: 'Histogramas, dispersão e correlações',
  },
  {
    key: 'series',
    path: '/datasets/series',
    icon: CalendarRange,
    label: 'Séries Temporais',
    hint: 'Evolução de casos por período',
  },
  {
    key: 'reports',
    path: '/datasets/reports',
    icon: FileText,
    label: 'Relatórios',
    hint: 'Resumo e exportação em PDF',
  },
]

export default function OverviewPage() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { datasets, activeDataset, isLoading, setActiveDataset, refresh } = useDatasets()

  const profile = activeDataset?.profile ?? null

  const metrics = useMemo(() => {
    if (!profile) return null
    const deaths = profile.metrics.obito?.total ?? 0
    const mortality = profile.rowCount > 0 ? (deaths / profile.rowCount) * 100 : 0
    return {
      records: profile.rowCount,
      deaths: Math.round(deaths),
      mortality,
      periods: profile.trendData.length,
    }
  }, [profile])

  const chartData = useMemo(
    () =>
      profile?.trendData.map((entry) => ({
        label: entry.group,
        value: entry.sampleSize,
      })) ?? [],
    [profile]
  )

  const displayedDatasets = useMemo(() => {
    if (settings.recentDatasetsCount === 'all') return datasets
    const limit = parseInt(settings.recentDatasetsCount, 10)
    return isNaN(limit) ? datasets.slice(0, 5) : datasets.slice(0, limit)
  }, [datasets, settings.recentDatasetsCount])

  const handleDatasetClick = (datasetId: string) => {
    setActiveDataset(datasetId)
    void navigate('/datasets/charts')
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={`${styles.page} ${styles.pageCentered}`}>
        <p className={styles.loadingText}>Carregando datasets...</p>
      </div>
    )
  }

  // ── Sem datasets ──────────────────────────────────────────────────────────
  if (datasets.length === 0) {
    return (
      <div className={`${styles.page} ${styles.pageCentered}`}>
        <div className={styles.onboarding}>
          <div className={styles.onboardingHeader}>
            <h1 className={`gradient-text ${styles.title}`}>Bem-vindo ao HealthLens</h1>
            <p className={styles.subtitle}>
              Comece importando seu primeiro dataset SINAN para acessar análises epidemiológicas.
            </p>
          </div>

          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <div className={styles.stepContent}>
                <strong className={styles.stepTitle}>Obtenha dados do SINAN</strong>
                <p className={styles.stepHint}>
                  Acesse o DataSUS (datasus.gov.br), selecione o agravo e exporte o arquivo{' '}
                  <code>.dbc</code>.
                </p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <div className={styles.stepContent}>
                <strong className={styles.stepTitle}>Importe o arquivo aqui</strong>
                <p className={styles.stepHint}>
                  Suporta <code>.DBC</code>, <code>.CSV</code>, <code>.JSON</code> e{' '}
                  <code>.XLSX</code>. As colunas são mapeadas automaticamente.
                </p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <div className={styles.stepContent}>
                <strong className={styles.stepTitle}>Explore análises automáticas</strong>
                <p className={styles.stepHint}>
                  Gráficos, séries temporais, relatórios epidemiológicos e chat com IA.
                </p>
              </div>
            </li>
          </ol>

          <div className={styles.onboardingActions}>
            <Button size="lg" onClick={() => void navigate('/datasets/new')}>
              <Download size={18} />
              <span>Importar primeiro dataset</span>
            </Button>
            <button type="button" className={styles.retryLink} onClick={() => void refresh()}>
              <RefreshCcw size={13} />
              <span>Recarregar</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Dashboard (com datasets) ───────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={`gradient-text ${styles.title}`}>Painel Epidemiológico</h1>
        <p className={styles.subtitle}>Visão geral do dataset ativo e acesso rápido às análises.</p>
      </header>

      {activeDataset && (
        <div className={styles.heroCard}>
          <div className={styles.heroLeft}>
            <div className={styles.heroDatasetMeta}>
              <span className={styles.heroLabel}>Dataset ativo</span>
              <strong className={styles.heroDatasetName}>{activeDataset.name}</strong>
              <span className={styles.heroDatasetDetail}>
                {activeDataset.sizeLabel} · Importado em {formatDate(activeDataset.uploadedAt)}
              </span>
            </div>

            {metrics && (
              <div className={styles.metricsStrip}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Registros</span>
                  <strong className={styles.metricValue}>{formatInteger(metrics.records)}</strong>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Óbitos</span>
                  <strong
                    className={`${styles.metricValue} ${metrics.deaths > 0 ? styles.metricDanger : ''}`}
                  >
                    {formatInteger(metrics.deaths)}
                  </strong>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Letalidade</span>
                  <strong
                    className={`${styles.metricValue} ${metrics.mortality > 5 ? styles.metricDanger : ''}`}
                  >
                    {formatDecimal(metrics.mortality)}%
                  </strong>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Períodos</span>
                  <strong className={styles.metricValue}>{metrics.periods}</strong>
                </div>
              </div>
            )}
          </div>

          {chartData.length > 0 && (
            <div className={styles.heroRight}>
              <span className={styles.heroChartLabel}>Evolução de casos</span>
              <div className={styles.heroChart}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <Tooltip
                      cursor={{ fill: 'var(--color-border, rgba(255,255,255,0.06))' }}
                      contentStyle={{
                        background: 'var(--color-surface-2)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value) => [formatInteger(value as number), 'Casos']}
                      labelFormatter={(label) => `Período: ${label}`}
                    />
                    <Bar
                      dataKey="value"
                      fill="var(--color-primary, #ff2d55)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.quickNav} aria-label="Atalhos de análise">
        {QUICK_NAV.map(({ key, path, icon: Icon, label, hint }) => (
          <button
            key={key}
            type="button"
            className={styles.navCard}
            onClick={() => void navigate(path)}
          >
            <div className={styles.navCardIcon}>
              <Icon size={20} />
            </div>
            <div className={styles.navCardText}>
              <strong className={styles.navCardLabel}>{label}</strong>
              <span className={styles.navCardHint}>{hint}</span>
            </div>
            <ArrowRight size={16} className={styles.navCardArrow} />
          </button>
        ))}
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Datasets Recentes</h2>
            <p className={styles.sectionHint}>
              Clique em um dataset para ativá-lo e ir para os gráficos.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void navigate('/datasets/list')}>
            Ver todos
            <ArrowRight size={16} style={{ marginLeft: 'var(--space-2)' }} />
          </Button>
        </div>

        <div className={datasetStyles.list}>
          {displayedDatasets.map((dataset) => (
            <div
              key={dataset.id}
              className={`${datasetStyles.datasetCard} ${dataset.id === activeDataset?.id ? datasetStyles.datasetCardActive : ''}`}
              onClick={() => handleDatasetClick(dataset.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleDatasetClick(dataset.id)
              }}
            >
              <div className={datasetStyles.info}>
                <div className={datasetStyles.iconWrapper}>
                  <Database size={24} />
                </div>
                <div className={datasetStyles.details}>
                  <span className={datasetStyles.name}>{dataset.name}</span>
                  <span className={datasetStyles.meta}>
                    Adicionado em {formatDate(dataset.uploadedAt)} — {dataset.sizeLabel}
                  </span>
                </div>
              </div>
              <ArrowRight size={16} style={{ flexShrink: 0, opacity: 0.4 }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BadgePercent,
  BarChart3,
  Download,
  RefreshCcw,
  Sigma,
  Skull,
  Users,
} from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/Button/Button'
import {
  fetchChartDatasets,
  getActiveChartDatasetId,
  setActiveChartDatasetId,
  type ChartDatasetProfile,
  type ChartDatasetRecord,
} from '@/utils/chartDatasets'
import styles from './ChartsPage.module.scss'

type MetricKey = 'nu_idade_n' | 'atraso_notific' | 'tempo_encerra'

type MetricPanel = {
  key: MetricKey
  label: string
  hint: string
}

type CategoryRow = {
  segment: string
  count: number
  ratio: number
}

type NumericStats = {
  total: number
  media: number
  media_movel: number
  mediana: number
  minimo: number
  maximo: number
  desvio_padrao: number
  p25: number
  p75: number
  variacao_percentual: number
  valores: number[]
}

const METRIC_PANELS: MetricPanel[] = [
  { key: 'nu_idade_n', label: 'Idade', hint: 'idade do paciente' },
  { key: 'atraso_notific', label: 'Atraso notificação', hint: 'dias até notificar' },
  { key: 'tempo_encerra', label: 'Tempo encerramento', hint: 'dias até encerrar' },
]

const INTEGER_FORMATTER = new Intl.NumberFormat('pt-BR')
const DECIMAL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const formatInteger = (value: number) => INTEGER_FORMATTER.format(Math.round(value))
const formatDecimal = (value: number) => DECIMAL_FORMATTER.format(value)
const formatPercent = (value: number) => `${formatDecimal(value)}%`
const formatCountPercent = (value: number, total: number) => {
  const percent = total > 0 ? (value / total) * 100 : 0
  return `${formatInteger(value)} (${formatPercent(percent)})`
}

const getTooltipLabel = (item: unknown) => {
  if (!item || typeof item !== 'object') return ''
  const payload = (item as { payload?: unknown }).payload
  if (!payload || typeof payload !== 'object') return ''
  const label = (payload as { label?: unknown }).label
  return typeof label === 'string' ? label : ''
}

const buildAgeBins = (values: number[]) => {
  const ranges = [
    { label: '0-9', min: 0, max: 9 },
    { label: '10-19', min: 10, max: 19 },
    { label: '20-29', min: 20, max: 29 },
    { label: '30-39', min: 30, max: 39 },
    { label: '40-49', min: 40, max: 49 },
    { label: '50-59', min: 50, max: 59 },
    { label: '60-69', min: 60, max: 69 },
    { label: '70-79', min: 70, max: 79 },
    { label: '80+', min: 80, max: null as number | null },
  ]

  return ranges.map((range) => {
    const count = values.filter((value) => {
      if (value < range.min) return false
      if (range.max === null) return value >= range.min
      return value <= range.max
    }).length

    return { label: range.label, value: count }
  })
}

const buildDelayBins = (values: number[]) => {
  const ranges = [
    { label: '0-2', min: 0, max: 2 },
    { label: '3-7', min: 3, max: 7 },
    { label: '8-14', min: 8, max: 14 },
    { label: '15-30', min: 15, max: 30 },
    { label: '31+', min: 31, max: null as number | null },
  ]

  return ranges.map((range) => {
    const count = values.filter((value) => {
      if (value < range.min) return false
      if (range.max === null) return value >= range.min
      return value <= range.max
    }).length

    return { label: range.label, value: count }
  })
}

const getFallbackStats = (): NumericStats => ({
  total: 0,
  media: 0,
  media_movel: 0,
  mediana: 0,
  minimo: 0,
  maximo: 0,
  desvio_padrao: 0,
  p25: 0,
  p75: 0,
  variacao_percentual: 0,
  valores: [],
})

const getNumericStats = (profile: ChartDatasetProfile, key: MetricKey): NumericStats => {
  const stats = profile.metrics[key]
  return stats ?? getFallbackStats()
}

const getCategoryRows = (profile: ChartDatasetProfile): CategoryRow[] =>
  profile.segmentData.map((entry) => ({
    segment: entry.segment,
    ratio: entry.ratio,
    count: entry.count,
  }))

const getKpis = (profile: ChartDatasetProfile) => {
  const cases = profile.rowCount
  const deaths = profile.metrics.obito?.total ?? 0
  const lethality = cases > 0 ? (deaths / cases) * 100 : 0

  return { cases, deaths, lethality }
}

export default function ChartsPage() {
  const navigate = useNavigate()
  const [datasets, setDatasets] = useState<ChartDatasetRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDatasetId, setSelectedDatasetId] = useState('')

  useEffect(() => {
    let cancelled = false

    const loadDatasets = async () => {
      setIsLoading(true)
      const loadedDatasets = await fetchChartDatasets()

      if (cancelled) return

      setDatasets(loadedDatasets)

      const activeId = getActiveChartDatasetId()
      const nextSelectedId =
        activeId && loadedDatasets.some((dataset) => dataset.id === activeId)
          ? activeId
          : (loadedDatasets[0]?.id ?? '')

      setSelectedDatasetId(nextSelectedId)
      if (nextSelectedId) {
        setActiveChartDatasetId(nextSelectedId)
      }
      setIsLoading(false)
    }

    void loadDatasets()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId]
  )

  const profile = selectedDataset?.profile ?? null

  const categoryRows = useMemo(() => (profile ? getCategoryRows(profile) : []), [profile])
  const categoryDisplayRows = useMemo(() => {
    const hasMeaningful = categoryRows.some((row) => row.segment !== 'Nao informado')
    return hasMeaningful ? categoryRows : []
  }, [categoryRows])
  const kpis = useMemo(() => (profile ? getKpis(profile) : null), [profile])
  const numericPanels = useMemo(() => {
    if (!profile) return []

    return METRIC_PANELS.map((panel) => ({
      ...panel,
      stats: getNumericStats(profile, panel.key),
    })).filter((panel) => panel.stats.valores.length > 0)
  }, [profile])

  const categoryChartData = useMemo(
    () =>
      categoryDisplayRows
        .slice(0, 5)
        .map((entry) => ({ label: entry.segment, value: entry.count })),
    [categoryDisplayRows]
  )
  const categoryTotal = useMemo(
    () => categoryChartData.reduce((sum, entry) => sum + entry.value, 0),
    [categoryChartData]
  )

  const summaryText = useMemo(() => {
    if (!profile || !kpis) return 'Sem dados suficientes para resumir este dataset.'

    const topCategory = categoryDisplayRows[0]
    const topMetric = numericPanels[0]?.stats

    const pieces = [
      `${formatInteger(kpis.cases)} casos`,
      `${formatInteger(kpis.deaths)} óbitos`,
      `letalidade de ${formatPercent(kpis.lethality)}`,
    ]

    if (topCategory) {
      pieces.push(`${topCategory.segment} concentra ${formatPercent(topCategory.ratio)}`)
    }

    if (topMetric) {
      pieces.push(`média principal de ${formatDecimal(topMetric.media)}`)
    }

    return pieces.join(' · ')
  }, [categoryDisplayRows, kpis, numericPanels, profile])

  if (isLoading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={`gradient-text ${styles.title}`}>Gráficos</h1>
            <p className={styles.subtitle}>Carregando datasets...</p>
          </div>
        </header>
      </div>
    )
  }

  if (!selectedDataset || !profile || !kpis) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={`gradient-text ${styles.title}`}>Gráficos</h1>
            <p className={styles.subtitle}>
              Nenhum dataset disponível. Faça upload de dados epidemiológicos para gerar a dashboard
              de vigilância.
            </p>
          </div>
        </header>

        <section className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            A dashboard trabalha com indicadores epidemiológicos: KPIs de notificações e óbitos,
            curvas temporais, distribuição demográfica e resumo de indicadores virais.
          </p>
          <Button type="button" size="lg" onClick={() => void navigate('/datasets/new')}>
            <Download size={18} />
            <span>Enviar dataset</span>
          </Button>
        </section>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={`gradient-text ${styles.title}`}>Gráficos</h1>
          <p className={styles.subtitle}>
            Dashboard de vigilância epidemiológica de doenças virais contagiosas.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigate('/datasets/new')}
          >
            <Download size={16} />
            <span>Importar</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigate('/datasets/list')}
          >
            <RefreshCcw size={16} />
            <span>Trocar dataset</span>
          </Button>
        </div>
      </header>

      <section className={styles.controlBar} aria-label="Selecionar dataset ativo">
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel} htmlFor="charts-dataset-select">
            Dataset ativo
          </label>
          <select
            id="charts-dataset-select"
            value={selectedDatasetId}
            onChange={(event) => {
              const nextId = event.target.value
              setSelectedDatasetId(nextId)
              setActiveChartDatasetId(nextId)
            }}
            className={styles.select}
          >
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.datasetMeta}>
          <span className={styles.metaLabel}>Arquivo</span>
          <strong className={styles.metaValue}>{selectedDataset.name}</strong>
          <span className={styles.metaHint}>{selectedDataset.sizeLabel}</span>
        </div>
      </section>

      <section className={styles.kpiGrid} aria-label="KPIs principais">
        <article className={styles.kpiCard}>
          <span className={styles.kpiIcon}>
            <Users size={20} />
          </span>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Casos</span>
            <strong className={styles.kpiValue}>{formatInteger(kpis.cases)}</strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiIcon}>
            <Skull size={20} />
          </span>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Óbitos</span>
            <strong className={styles.kpiValue}>{formatInteger(kpis.deaths)}</strong>
          </div>
        </article>

        <article className={styles.kpiCard}>
          <span className={styles.kpiIcon}>
            <BadgePercent size={20} />
          </span>
          <div className={styles.kpiBody}>
            <span className={styles.kpiLabel}>Letalidade</span>
            <strong className={styles.kpiValue}>{formatPercent(kpis.lethality)}</strong>
          </div>
        </article>
      </section>

      <section className={styles.grid} aria-label="Análise epidemiológica">
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <BarChart3 size={18} />
                Categóricos
              </h2>
              <p className={styles.cardDescription}>
                Distribuição dos casos por categorias demográficas e epidemiológicas.
              </p>
            </div>
            <span className={styles.badge}>Contagem + %</span>
          </div>

          <div className={styles.miniChart}>
            {categoryChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <XAxis dataKey="label" hide />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    formatter={(value) => [
                      formatCountPercent(Number(value), categoryTotal),
                      'Registros',
                    ]}
                  />
                  <Bar dataKey="value" fill="var(--color-primary, #ff2d55)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.miniPlaceholder}>Sem dados</div>
            )}
          </div>

          <div className={styles.categoryList}>
            {categoryDisplayRows.length ? (
              categoryDisplayRows.map((entry) => (
                <div key={entry.segment} className={styles.categoryRow}>
                  <div className={styles.categoryLabelWrap}>
                    <strong className={styles.categoryLabel}>{entry.segment}</strong>
                    <span className={styles.categoryMeta}>
                      {formatInteger(entry.count)} registros
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.placeholder}>Sem distribuição categórica suficiente.</div>
            )}
          </div>
        </article>
        {numericPanels.map((panel) => {
          const chartData =
            panel.key === 'nu_idade_n'
              ? buildAgeBins(panel.stats.valores)
              : buildDelayBins(panel.stats.valores)
          const chartTotal = chartData.reduce((sum, entry) => sum + entry.value, 0)
          const chartColor =
            panel.key === 'nu_idade_n'
              ? 'var(--color-primary, #ff2d55)'
              : 'var(--color-info, #0a84ff)'

          return (
            <article key={panel.key} className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>
                    <Sigma size={18} />
                    {panel.label}
                  </h2>
                  <p className={styles.cardDescription}>{panel.hint}</p>
                </div>
                <span className={styles.badge}>Numérico</span>
              </div>

              <div className={styles.miniChart}>
                {panel.stats.valores.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="label" hide />
                      <YAxis hide />
                      <Tooltip
                        formatter={(value, _name, item) => {
                          const label = getTooltipLabel(item) || 'Registros'
                          return [formatCountPercent(Number(value), chartTotal), label]
                        }}
                      />
                      <Bar dataKey="value" fill={chartColor} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={styles.miniPlaceholder}>Sem dados</div>
                )}
              </div>

              <div className={styles.numericGrid}>
                <div className={styles.numericItem}>
                  <span className={styles.summaryLabel}>Média</span>
                  <strong className={styles.numericValue}>
                    {formatDecimal(panel.stats.media)}
                  </strong>
                </div>
                <div className={styles.numericItem}>
                  <span className={styles.summaryLabel}>Mediana</span>
                  <strong className={styles.numericValue}>
                    {formatDecimal(panel.stats.mediana)}
                  </strong>
                </div>
                <div className={styles.numericItem}>
                  <span className={styles.summaryLabel}>Mínimo</span>
                  <strong className={styles.numericValue}>
                    {formatDecimal(panel.stats.minimo)}
                  </strong>
                </div>
                <div className={styles.numericItem}>
                  <span className={styles.summaryLabel}>Máximo</span>
                  <strong className={styles.numericValue}>
                    {formatDecimal(panel.stats.maximo)}
                  </strong>
                </div>
              </div>
            </article>
          )
        })}
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              <Activity size={18} />
              Resumo Epidemiológico
            </h2>
            <p className={styles.cardDescription}>
              Síntese dos indicadores de vigilância viral do dataset ativo.
            </p>
          </div>
        </div>

        <p className={styles.summaryText}>{summaryText}</p>
      </section>
    </div>
  )
}

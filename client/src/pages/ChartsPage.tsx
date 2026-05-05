import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  BadgePercent,
  BarChart3,
  CalendarRange,
  Download,
  RefreshCcw,
  Sigma,
  Skull,
  Users,
} from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

type TrendRow = {
  label: string
  cases: number
  movingAverage: number
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

const safeAverage = (values: number[]) => {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const variationPercent = (values: number[]) => {
  if (values.length < 2) return 0
  const first = values[0]
  const last = values[values.length - 1]

  if (first === 0) return last === 0 ? 0 : 100

  return ((last - first) / Math.abs(first)) * 100
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

const getTrendRows = (profile: ChartDatasetProfile): TrendRow[] => {
  const cases = profile.trendData.map((entry) => entry.sampleSize)
  const averages = cases.map((_, index) =>
    safeAverage(cases.slice(Math.max(0, index - 2), index + 1))
  )

  return profile.trendData.map((entry, index) => ({
    label: entry.group,
    cases: entry.sampleSize,
    movingAverage: averages[index] ?? entry.sampleSize,
  }))
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

  const trendRows = useMemo(() => (profile ? getTrendRows(profile) : []), [profile])
  const categoryRows = useMemo(() => (profile ? getCategoryRows(profile) : []), [profile])
  const kpis = useMemo(() => (profile ? getKpis(profile) : null), [profile])
  const numericPanels = useMemo(() => {
    if (!profile) return []

    return METRIC_PANELS.map((panel) => ({
      ...panel,
      stats: getNumericStats(profile, panel.key),
    }))
  }, [profile])

  const trendCases = trendRows.map((row) => row.cases)
  const trendVariation = variationPercent(trendCases)

  const summaryText = useMemo(() => {
    if (!profile || !kpis) return 'Sem dados suficientes para resumir este dataset.'

    const topCategory = categoryRows[0]
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
  }, [categoryRows, kpis, numericPanels, profile])

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

      <section className={styles.grid} aria-label="Análise temporal e categórica">
        <article className={`${styles.card} ${styles.cardWide}`}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>
                <CalendarRange size={18} />
                Temporal
              </h2>
              <p className={styles.cardDescription}>
                Curva epidemiológica: notificações por período, média móvel e variação.
              </p>
            </div>
            <span className={styles.badge}>{trendRows.length} períodos</span>
          </div>

          <div className={styles.chartBox}>
            {trendRows.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid
                    stroke="var(--color-border-strong, #d4d4d8)"
                    strokeDasharray="3 3"
                  />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} width={44} />
                  <Tooltip
                    formatter={(value, name) =>
                      typeof value === 'number'
                        ? [formatDecimal(value), String(name)]
                        : [String(value), String(name)]
                    }
                  />
                  <Bar
                    dataKey="cases"
                    fill="var(--color-chart-accent, #ff2d55)"
                    radius={[8, 8, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    stroke="var(--color-info, #0a84ff)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className={styles.placeholder}>Sem série temporal suficiente para exibir.</div>
            )}
          </div>

          <div className={styles.trendSummary}>
            <div>
              <span className={styles.summaryLabel}>Média móvel</span>
              <strong className={styles.summaryValue}>
                {formatDecimal(safeAverage(trendRows.map((row) => row.movingAverage)))}
              </strong>
            </div>
            <div>
              <span className={styles.summaryLabel}>Variação %</span>
              <strong className={styles.summaryValue}>{formatPercent(trendVariation)}</strong>
            </div>
          </div>
        </article>

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

          <div className={styles.categoryList}>
            {categoryRows.length ? (
              categoryRows.map((entry) => (
                <div key={entry.segment} className={styles.categoryRow}>
                  <div className={styles.categoryLabelWrap}>
                    <strong className={styles.categoryLabel}>{entry.segment}</strong>
                    <span className={styles.categoryMeta}>
                      {formatInteger(entry.count)} registros
                    </span>
                  </div>
                  <strong className={styles.categoryRatio}>{formatPercent(entry.ratio)}</strong>
                </div>
              ))
            ) : (
              <div className={styles.placeholder}>Sem distribuição categórica suficiente.</div>
            )}
          </div>
        </article>
      </section>

      <section className={styles.grid} aria-label="Resumo numérico">
        {numericPanels.map((panel) => (
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

            <div className={styles.numericGrid}>
              <div className={styles.numericItem}>
                <span className={styles.summaryLabel}>Média</span>
                <strong className={styles.numericValue}>{formatDecimal(panel.stats.media)}</strong>
              </div>
              <div className={styles.numericItem}>
                <span className={styles.summaryLabel}>Mediana</span>
                <strong className={styles.numericValue}>
                  {formatDecimal(panel.stats.mediana)}
                </strong>
              </div>
              <div className={styles.numericItem}>
                <span className={styles.summaryLabel}>Mínimo</span>
                <strong className={styles.numericValue}>{formatDecimal(panel.stats.minimo)}</strong>
              </div>
              <div className={styles.numericItem}>
                <span className={styles.summaryLabel}>Máximo</span>
                <strong className={styles.numericValue}>{formatDecimal(panel.stats.maximo)}</strong>
              </div>
            </div>
          </article>
        ))}
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

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, Download, RefreshCcw } from 'lucide-react'
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
import styles from './SeriesPage.module.scss'

type TrendRow = {
  label: string
  cases: number
  movingAverage: number
}

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

export default function SeriesPage() {
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
  const trendCases = trendRows.map((row) => row.cases)
  const trendVariation = variationPercent(trendCases)
  const totalPeriods = trendRows.length
  const averageCases = safeAverage(trendCases)
  const peakEntry = trendRows.reduce<TrendRow | null>(
    (current, entry) => (!current || entry.cases > current.cases ? entry : current),
    null
  )
  const latestEntry = trendRows[trendRows.length - 1] ?? null

  if (isLoading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={`gradient-text ${styles.title}`}>Séries Temporais</h1>
            <p className={styles.subtitle}>Carregando datasets...</p>
          </div>
        </header>
      </div>
    )
  }

  if (!selectedDataset || !profile) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={`gradient-text ${styles.title}`}>Séries Temporais</h1>
            <p className={styles.subtitle}>
              Nenhum dataset disponível. Faça upload para visualizar as séries temporais.
            </p>
          </div>
        </header>

        <section className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Importe um dataset SINAN para acompanhar a evolução temporal dos casos.
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
          <h1 className={`gradient-text ${styles.title}`}>Séries Temporais</h1>
          <p className={styles.subtitle}>Acompanhe a evolução de casos por período.</p>
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
          <label className={styles.controlLabel} htmlFor="series-dataset-select">
            Dataset ativo
          </label>
          <select
            id="series-dataset-select"
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

      <section className={styles.summaryGrid} aria-label="Resumo temporal">
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Períodos</span>
          <strong className={styles.summaryValue}>{formatInteger(totalPeriods)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Média por período</span>
          <strong className={styles.summaryValue}>{formatDecimal(averageCases)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Pico</span>
          <strong className={styles.summaryValue}>
            {peakEntry ? `${formatInteger(peakEntry.cases)} · ${peakEntry.label}` : 'Sem dados'}
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Último período</span>
          <strong className={styles.summaryValue}>
            {latestEntry
              ? `${formatInteger(latestEntry.cases)} · ${latestEntry.label}`
              : 'Sem dados'}
          </strong>
        </article>
      </section>

      <section className={styles.card} aria-label="Análise temporal">
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>
              <CalendarRange size={18} />
              Temporal
            </h2>
            <p className={styles.cardDescription}>
              Casos por período, média móvel e variação percentual.
            </p>
          </div>
          <span className={styles.badge}>{trendRows.length} períodos</span>
        </div>

        <div className={styles.chartBox}>
          {trendRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border-strong, #d4d4d8)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  formatter={(value, name) => {
                    const label = name === 'cases' ? 'Casos' : 'Média móvel'
                    return typeof value === 'number'
                      ? [formatDecimal(value), label]
                      : [String(value), label]
                  }}
                />
                <Bar
                  dataKey="cases"
                  fill="var(--color-primary, #ff2d55)"
                  radius={[8, 8, 0, 0]}
                  barSize={18}
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
      </section>
    </div>
  )
}

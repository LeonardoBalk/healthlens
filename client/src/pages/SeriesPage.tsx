import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarRange, Download, RefreshCcw } from 'lucide-react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/Button/Button'
import { useDatasets } from '@/contexts/DatasetContext'
import { type ChartDatasetProfile } from '@/utils/chartDatasets'
import styles from './SeriesPage.module.scss'

type TrendRow = {
  label: string
  cases: number
  movingAverage: number
  deaths: number
}

const INTEGER_FORMATTER = new Intl.NumberFormat('pt-BR')
const DECIMAL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const formatInteger = (value: number) => INTEGER_FORMATTER.format(Math.round(value))
const formatDecimal = (value: number) => DECIMAL_FORMATTER.format(value)
const formatSignedPercent = (value: number) => {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatDecimal(Math.abs(value))}%`
}

const safeAverage = (values: number[]) => {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const variationPercent = (values: number[]) => {
  if (values.length < 2) return 0
  const mid = Math.ceil(values.length / 2)
  const firstAvg = safeAverage(values.slice(0, mid))
  const secondAvg = safeAverage(values.slice(mid))
  if (firstAvg === 0) return secondAvg === 0 ? 0 : 100
  return ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100
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
    deaths: entry.secondary ?? 0,
  }))
}

export default function SeriesPage() {
  const navigate = useNavigate()
  const { datasets, activeDataset, isLoading, setActiveDataset } = useDatasets()
  const [toast, setToast] = useState<string | null>(null)

  const profile = activeDataset?.profile ?? null
  const trendRows = useMemo(() => (profile ? getTrendRows(profile) : []), [profile])
  const trendCases = trendRows.map((row) => row.cases)
  const trendVariation = variationPercent(trendCases)
  const hasDeaths = trendRows.some((row) => row.deaths > 0)
  const totalPeriods = trendRows.length
  const averageCases = safeAverage(trendCases)
  const peakEntry = trendRows.reduce<TrendRow | null>(
    (current, entry) => (!current || entry.cases > current.cases ? entry : current),
    null
  )
  const latestEntry = trendRows[trendRows.length - 1] ?? null
  const previousEntry = trendRows[trendRows.length - 2] ?? null
  const latestDelta =
    latestEntry && previousEntry && previousEntry.cases > 0
      ? ((latestEntry.cases - previousEntry.cases) / previousEntry.cases) * 100
      : null
  const latestDeltaLabel = latestDelta === null ? 'Sem dados' : formatSignedPercent(latestDelta)
  const latestDeltaTone =
    latestDelta === null
      ? styles.trendNeutral
      : latestDelta >= 0
        ? styles.trendUp
        : styles.trendDown

  const handleDatasetChange = (id: string) => {
    setActiveDataset(id)
    const name = datasets.find((d) => d.id === id)?.name ?? ''
    setToast(name)
    setTimeout(() => setToast(null), 2500)
  }

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

  if (!activeDataset || !profile) {
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
            value={activeDataset.id}
            onChange={(event) => handleDatasetChange(event.target.value)}
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
          <strong className={styles.metaValue}>{activeDataset.name}</strong>
          <span className={styles.metaHint}>{activeDataset.sizeLabel}</span>
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
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Variação última</span>
          <strong className={`${styles.summaryValue} ${latestDeltaTone}`}>
            {latestDeltaLabel}
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
                  labelFormatter={(label) => `Período: ${label}`}
                  formatter={(value, name) => {
                    if (name === 'cases') return [formatInteger(value as number), 'Casos']
                    if (name === 'movingAverage')
                      return [formatDecimal(value as number), 'Média móvel']
                    if (name === 'deaths') return [formatInteger(value as number), 'Óbitos']
                    return [String(value), name]
                  }}
                />
                <ReferenceLine
                  y={Math.round(averageCases)}
                  stroke="var(--color-text-secondary)"
                  strokeDasharray="6 3"
                  strokeOpacity={0.6}
                  label={{
                    value: 'Média',
                    position: 'insideTopRight',
                    fontSize: 11,
                    fill: 'var(--color-text-secondary)',
                  }}
                />
                <Bar
                  dataKey="cases"
                  fill="var(--color-primary, #ff2d55)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  type="monotone"
                  dataKey="movingAverage"
                  stroke="var(--color-info, #0a84ff)"
                  strokeWidth={2.5}
                  dot={false}
                />
                {hasDeaths && (
                  <Line
                    type="monotone"
                    dataKey="deaths"
                    stroke="var(--color-danger, #ff3b30)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                )}
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
            <span className={styles.summaryLabel}>Tendência</span>
            <strong
              className={`${styles.summaryValue} ${trendVariation > 0 ? styles.trendUp : trendVariation < 0 ? styles.trendDown : ''}`}
            >
              {formatSignedPercent(trendVariation)}
            </strong>
          </div>
        </div>
      </section>

      {toast && (
        <div className={styles.toast} role="status">
          Dataset ativo: <strong>{toast}</strong>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
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
  movingAverage: number | null
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

const MONTHS_PT: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
}

const parseTrendLabel = (label: string): Date | null => {
  const m = /^([a-záéíóú]{3})\/(\d{2})$/i.exec(label)
  if (m) {
    const month = MONTHS_PT[m[1].toLowerCase()]
    if (month === undefined) return null
    const yr = parseInt(m[2])
    return new Date(yr < 50 ? 2000 + yr : 1900 + yr, month, 1)
  }
  const y = /^(\d{4})$/.exec(label)
  if (y) return new Date(parseInt(y[1]), 6, 1)
  return null
}

const GAP_THRESHOLD_MONTHS = 3

const variationPercent = (values: number[]) => {
  if (values.length < 2) return 0
  const mid = Math.ceil(values.length / 2)
  const firstAvg = safeAverage(values.slice(0, mid))
  const secondAvg = safeAverage(values.slice(mid))
  if (firstAvg === 0) return secondAvg === 0 ? 0 : 100
  return ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100
}

const getTrendRows = (profile: ChartDatasetProfile): TrendRow[] => {
  const entries = profile.trendData.filter((e) => e.group !== 'Sem data')
  const cases = entries.map((e) => e.sampleSize)
  const averages = cases.map((_, i) => safeAverage(cases.slice(Math.max(0, i - 2), i + 1)))

  const base: TrendRow[] = entries.map((entry, i) => ({
    label: entry.group,
    cases: entry.sampleSize,
    movingAverage: averages[i] ?? entry.sampleSize,
    deaths: entry.secondary ?? 0,
  }))

  const result: TrendRow[] = []
  for (let i = 0; i < base.length; i++) {
    if (i > 0) {
      const prev = parseTrendLabel(base[i - 1].label)
      const curr = parseTrendLabel(base[i].label)
      if (prev && curr) {
        const months =
          (curr.getFullYear() - prev.getFullYear()) * 12 + (curr.getMonth() - prev.getMonth())
        if (months > GAP_THRESHOLD_MONTHS) {
          result.push({ label: '', cases: 0, movingAverage: null, deaths: 0 })
        }
      }
    }
    result.push(base[i])
  }
  return result
}

export default function SeriesPage() {
  const navigate = useNavigate()
  const { datasets, activeDataset, isLoading, setActiveDataset } = useDatasets()
  const [toast, setToast] = useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = useState<'6' | '12' | '24' | '36' | 'all'>('all')
  const [trackedDatasetId, setTrackedDatasetId] = useState(activeDataset?.id)

  if (trackedDatasetId !== activeDataset?.id) {
    setTrackedDatasetId(activeDataset?.id)
    setPeriodFilter('all')
  }

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    },
    []
  )

  const profile = activeDataset?.profile ?? null

  const undatedCount = useMemo(() => {
    if (!profile) return 0
    return profile.trendData
      .filter((entry) => entry.group === 'Sem data')
      .reduce((sum, entry) => sum + entry.sampleSize, 0)
  }, [profile])

  const allTrendRows = useMemo(() => (profile ? getTrendRows(profile) : []), [profile])

  const trendRows = useMemo(() => {
    if (periodFilter === 'all') return allTrendRows
    const n = parseInt(periodFilter, 10)
    const realRows = allTrendRows.filter((r) => r.label !== '')
    if (!realRows.length) return allTrendRows

    const latestDate = parseTrendLabel(realRows[realRows.length - 1].label)
    if (!latestDate) return allTrendRows

    const cutoff = new Date(latestDate)
    cutoff.setMonth(cutoff.getMonth() - n)

    const firstInRange = realRows.find((r) => {
      const d = parseTrendLabel(r.label)
      return d !== null && d > cutoff
    })
    if (!firstInRange) return allTrendRows

    return allTrendRows.slice(allTrendRows.indexOf(firstInRange))
  }, [allTrendRows, periodFilter])

  // gap entries (label: '') only exist to break the line — exclude from all stats
  const realTrendRows = useMemo(() => trendRows.filter((r) => r.label !== ''), [trendRows])

  const {
    trendVariation,
    hasDeaths,
    totalPeriods,
    averageCases,
    peakEntry,
    latestEntry,
    latestDelta,
  } = useMemo(() => {
    const cases = realTrendRows.map((row) => row.cases)
    return {
      trendVariation: variationPercent(cases),
      hasDeaths: realTrendRows.some((row) => row.deaths > 0),
      totalPeriods: realTrendRows.length,
      averageCases: safeAverage(cases),
      peakEntry: realTrendRows.reduce<TrendRow | null>(
        (current, entry) => (!current || entry.cases > current.cases ? entry : current),
        null
      ),
      latestEntry: realTrendRows[realTrendRows.length - 1] ?? null,
      latestDelta: (() => {
        const latest = realTrendRows[realTrendRows.length - 1] ?? null
        const prev = realTrendRows[realTrendRows.length - 2] ?? null
        if (!latest || !prev || prev.cases === 0) return null
        return ((latest.cases - prev.cases) / prev.cases) * 100
      })(),
    }
  }, [realTrendRows])

  const latestDeltaLabel = latestDelta === null ? 'Sem dados' : formatSignedPercent(latestDelta)
  const latestDeltaTone =
    latestDelta === null
      ? styles.trendNeutral
      : latestDelta >= 0
        ? styles.trendUp
        : styles.trendDown

  const handleDatasetChange = (id: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setActiveDataset(id)
    setToast(datasets.find((d) => d.id === id)?.name ?? '')
    toastTimerRef.current = setTimeout(() => setToast(null), 2500)
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
              Nenhum dataset disponível para visualizar séries temporais.
            </p>
          </div>
        </header>
        <section className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Importe um dataset SINAN para acessar as séries temporais.
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

        <div className={styles.controlGroup} style={{ flex: '0 0 auto', minWidth: '12rem' }}>
          <label className={styles.controlLabel} htmlFor="series-period-select">
            Período exibido
          </label>
          <select
            id="series-period-select"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as typeof periodFilter)}
            className={styles.select}
          >
            <option value="6">Últimos 6 meses</option>
            <option value="12">Últimos 12 meses</option>
            <option value="24">Últimos 24 meses</option>
            <option value="36">Últimos 36 meses</option>
            <option value="all">Todos os períodos</option>
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
          <span className={styles.badge}>{realTrendRows.length} períodos</span>
        </div>

        <div className={styles.chartBox}>
          {trendRows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border-strong, #d4d4d8)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length || !label) return null
                    return (
                      <div className={styles.tooltipBox}>
                        <p className={styles.tooltipLabel}>Período: {label}</p>
                        {payload.map((item) => {
                          if (item.value == null) return null
                          const name =
                            item.dataKey === 'cases'
                              ? 'Casos'
                              : item.dataKey === 'movingAverage'
                                ? 'Média móvel'
                                : item.dataKey === 'deaths'
                                  ? 'Óbitos'
                                  : String(item.name)
                          const formatted =
                            item.dataKey === 'movingAverage'
                              ? formatDecimal(item.value as number)
                              : formatInteger(item.value as number)
                          return (
                            <p
                              key={item.dataKey}
                              className={styles.tooltipRow}
                              style={{ color: item.color }}
                            >
                              {name}: <strong>{formatted}</strong>
                            </p>
                          )
                        })}
                      </div>
                    )
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
                  connectNulls={false}
                />
                {hasDeaths && (
                  <Line
                    type="monotone"
                    dataKey="deaths"
                    stroke="var(--color-danger, #ff3b30)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    connectNulls={false}
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
              {formatDecimal(
                safeAverage(
                  realTrendRows
                    .filter((r) => r.movingAverage !== null)
                    .map((r) => r.movingAverage as number)
                )
              )}
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

        {undatedCount > 0 && (
          <p className={styles.undatedNote}>
            {undatedCount.toLocaleString('pt-BR')} registro{undatedCount > 1 ? 's' : ''} sem data de
            notificação {undatedCount > 1 ? 'foram excluídos' : 'foi excluído'} desta visualização.
          </p>
        )}
      </section>

      {toast && (
        <div className={styles.toast} role="status">
          Dataset ativo: <strong>{toast}</strong>
        </div>
      )}
    </div>
  )
}

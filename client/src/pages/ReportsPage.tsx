import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Download, FileJson, FileText, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { useDatasets } from '@/contexts/DatasetContext'
import { exportDataset, type ChartDatasetProfile } from '@/utils/chartDatasets'
import styles from './ReportsPage.module.scss'

const INTEGER_FORMATTER = new Intl.NumberFormat('pt-BR')
const DECIMAL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const formatInteger = (value: number) => INTEGER_FORMATTER.format(Math.round(value))
const formatDecimal = (value: number) => DECIMAL_FORMATTER.format(value)

const formatDate = (isoDate: string) => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.valueOf())) return isoDate
  return parsed.toLocaleDateString('pt-BR')
}

type TrendRow = { label: string; cases: number; deaths: number }

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

const buildTrendRows = (
  profile: ChartDatasetProfile
): { rows: TrendRow[]; undatedCount: number } => {
  const undatedCount = profile.trendData
    .filter((e) => e.group === 'Sem data')
    .reduce((sum, e) => sum + e.sampleSize, 0)

  const base: TrendRow[] = profile.trendData
    .filter((e) => e.group !== 'Sem data')
    .map((entry) => ({
      label: entry.group,
      cases: entry.sampleSize,
      deaths: entry.secondary ?? 0,
    }))

  const rows: TrendRow[] = []
  for (let i = 0; i < base.length; i++) {
    if (i > 0) {
      const prev = parseTrendLabel(base[i - 1].label)
      const curr = parseTrendLabel(base[i].label)
      if (prev && curr) {
        const months =
          (curr.getFullYear() - prev.getFullYear()) * 12 + (curr.getMonth() - prev.getMonth())
        if (months > GAP_THRESHOLD_MONTHS) {
          rows.push({ label: '', cases: 0, deaths: 0 })
        }
      }
    }
    rows.push(base[i])
  }

  return { rows, undatedCount }
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const { datasets, activeDataset, isLoading, setActiveDataset } = useDatasets()

  const profile = activeDataset?.profile ?? null

  const { rows: trendRows, undatedCount } = useMemo(
    () => (profile ? buildTrendRows(profile) : { rows: [], undatedCount: 0 }),
    [profile]
  )

  // gap entries (label: '') only exist to break chart lines — exclude from stats and table
  const realTrendRows = useMemo(() => trendRows.filter((r) => r.label !== ''), [trendRows])

  const totalCases = profile?.rowCount ?? 0
  const totalDeaths = useMemo(() => {
    if (!profile) return 0
    const fromMetrics = profile.metrics.obito?.total
    if (typeof fromMetrics === 'number' && fromMetrics > 0) return Math.round(fromMetrics)
    const fromValues = profile.metrics.obito?.valores
    if (Array.isArray(fromValues) && fromValues.length > 0) {
      return fromValues.reduce<number>((sum, v) => sum + (v === 1 ? 1 : 0), 0)
    }
    return 0
  }, [profile])

  const mortalityRate = totalCases > 0 ? (totalDeaths / totalCases) * 100 : 0
  const hasDeaths = realTrendRows.some((row) => row.deaths > 0)
  const averageCases =
    realTrendRows.length > 0
      ? realTrendRows.reduce((sum, row) => sum + row.cases, 0) / realTrendRows.length
      : 0

  if (isLoading) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={`gradient-text ${styles.title}`}>Relatórios</h1>
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
            <h1 className={`gradient-text ${styles.title}`}>Relatórios</h1>
            <p className={styles.subtitle}>Nenhum dataset disponível para gerar relatório.</p>
          </div>
        </header>
        <section className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Importe um dataset SINAN para acessar os relatórios epidemiológicos.
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
      <header className={styles.header} data-no-print>
        <div className={styles.titleBlock}>
          <h1 className={`gradient-text ${styles.title}`}>Relatórios</h1>
          <p className={styles.subtitle}>Resumo epidemiológico e indicadores do dataset ativo.</p>
        </div>
        <div className={styles.headerActions}>
          <Button type="button" size="sm" onClick={() => window.print()}>
            <Printer size={16} />
            <span>Exportar PDF</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void navigate('/datasets/new')}
          >
            <Download size={16} />
            <span>Importar</span>
          </Button>
        </div>
      </header>

      <div className={styles.printHeader}>
        <div className={styles.printHeaderBrand}>
          <img src="/healthlens-logo.svg" alt="HealthLens" className={styles.printLogo} />
          <span className={styles.printBrandName}>HealthLens</span>
        </div>
        <div className={styles.printHeaderMeta}>
          <strong>{activeDataset.name}</strong>
          <span>Gerado em {new Date().toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      <section className={styles.controlBar} aria-label="Selecionar dataset" data-no-print>
        <div className={styles.controlGroup}>
          <label className={styles.controlLabel} htmlFor="reports-dataset-select">
            Dataset ativo
          </label>
          <select
            id="reports-dataset-select"
            value={activeDataset.id}
            onChange={(e) => setActiveDataset(e.target.value)}
            className={styles.select}
          >
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.exportActions}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportDataset(activeDataset, 'csv')}
          >
            <FileText size={15} />
            <span>Exportar CSV</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportDataset(activeDataset, 'json')}
          >
            <FileJson size={15} />
            <span>Exportar JSON</span>
          </Button>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Indicadores principais">
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total de registros</span>
          <strong className={styles.summaryValue}>{formatInteger(totalCases)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total de óbitos</span>
          <strong
            className={`${styles.summaryValue} ${totalDeaths > 0 ? styles.summaryDanger : ''}`}
          >
            {formatInteger(totalDeaths)}
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Taxa de mortalidade</span>
          <strong
            className={`${styles.summaryValue} ${mortalityRate > 5 ? styles.summaryDanger : ''}`}
          >
            {formatDecimal(mortalityRate)}%
          </strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Períodos na série</span>
          <strong className={styles.summaryValue}>{formatInteger(realTrendRows.length)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Média por período</span>
          <strong className={styles.summaryValue}>{formatDecimal(averageCases)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Upload em</span>
          <strong className={styles.summaryValue}>{formatDate(activeDataset.uploadedAt)}</strong>
        </article>
      </section>

      {trendRows.length > 0 && (
        <section className={styles.card} aria-label="Série temporal">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Evolução Temporal</h2>
              <p className={styles.cardDescription}>
                Casos{hasDeaths ? ' e óbitos' : ''} por período.
              </p>
            </div>
            <span className={styles.badge}>{realTrendRows.length} períodos</span>
          </div>

          <div className={styles.chartBox} data-no-print>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendRows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--color-border-strong, #3f3f46)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  labelFormatter={(label) => `Período: ${label}`}
                  formatter={(value, name) => {
                    if (name === 'cases') return [formatInteger(value as number), 'Casos']
                    if (name === 'deaths') return [formatInteger(value as number), 'Óbitos']
                    return [String(value), name]
                  }}
                />
                <ReferenceLine
                  y={Math.round(averageCases)}
                  stroke="var(--color-text-secondary)"
                  strokeDasharray="6 3"
                  strokeOpacity={0.5}
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
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
                {hasDeaths && (
                  <Line
                    type="monotone"
                    dataKey="deaths"
                    stroke="var(--color-danger, #ff3b30)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {undatedCount > 0 && (
            <p className={styles.undatedNote}>
              {undatedCount.toLocaleString('pt-BR')} registro{undatedCount > 1 ? 's' : ''} sem data
              de notificação {undatedCount > 1 ? 'foram excluídos' : 'foi excluído'} desta
              visualização.
            </p>
          )}

          <div className={`${styles.tableWrapper} ${styles.printOnly}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Casos</th>
                  {hasDeaths && <th>Óbitos</th>}
                </tr>
              </thead>
              <tbody>
                {realTrendRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{formatInteger(row.cases)}</td>
                    {hasDeaths && <td>{formatInteger(row.deaths ?? 0)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {undatedCount > 0 && (
            <p className={`${styles.undatedNote} ${styles.printOnly}`}>
              * {undatedCount.toLocaleString('pt-BR')} registro{undatedCount > 1 ? 's' : ''} sem
              data de notificação excluído{undatedCount > 1 ? 's' : ''} da série temporal.
            </p>
          )}
        </section>
      )}

      {profile.segmentData.length > 0 && (
        <section className={styles.card} aria-label="Distribuição por segmento">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Distribuição Demográfica</h2>
              <p className={styles.cardDescription}>
                Proporção de casos por categoria ({profile.segmentData.length} grupos).
              </p>
            </div>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Segmento</th>
                  <th>Casos</th>
                  <th style={{ minWidth: '12rem' }}>Proporção</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {profile.segmentData.map((entry) => (
                  <tr key={entry.segment}>
                    <td>{entry.segment}</td>
                    <td>{formatInteger(entry.count)}</td>
                    <td>
                      <div className={styles.segmentBar}>
                        <div className={styles.segmentBarTrack}>
                          <div
                            className={styles.segmentBarFill}
                            style={{ width: `${entry.ratio}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.segmentBarLabel}>{formatDecimal(entry.ratio)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {profile.distributionData.length > 0 && (
        <section className={styles.card} aria-label="Estatísticas de distribuição">
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Estatísticas Descritivas</h2>
              <p className={styles.cardDescription}>
                Resumo estatístico dos indicadores numéricos.
              </p>
            </div>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th>Mín</th>
                  <th>Q1</th>
                  <th>Mediana</th>
                  <th>Q3</th>
                  <th>Máx</th>
                  <th>IQR</th>
                </tr>
              </thead>
              <tbody>
                {profile.distributionData.map((entry) => (
                  <tr key={entry.indicador}>
                    <td>{entry.indicador}</td>
                    <td>{formatDecimal(entry.min)}</td>
                    <td>{formatDecimal(entry.q1)}</td>
                    <td>{formatDecimal(entry.median)}</td>
                    <td>{formatDecimal(entry.q3)}</td>
                    <td>{formatDecimal(entry.max)}</td>
                    <td>{formatDecimal(entry.iqr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

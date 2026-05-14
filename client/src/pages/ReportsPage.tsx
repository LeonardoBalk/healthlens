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

const buildTrendRows = (profile: ChartDatasetProfile): TrendRow[] =>
  profile.trendData.map((entry) => ({
    label: entry.group,
    cases: entry.sampleSize,
    deaths: entry.secondary ?? 0,
  }))

export default function ReportsPage() {
  const navigate = useNavigate()
  const { datasets, activeDataset, isLoading, setActiveDataset } = useDatasets()

  const profile = activeDataset?.profile ?? null
  const trendRows = useMemo(() => (profile ? buildTrendRows(profile) : []), [profile])

  const totalCases = profile?.rowCount ?? 0
  const totalDeaths = useMemo(() => {
    if (!profile) return 0
    const fromMetrics = profile.metrics.obito?.total
    if (typeof fromMetrics === 'number' && fromMetrics > 0) return Math.round(fromMetrics)
    return trendRows.reduce((sum, row) => sum + row.deaths, 0)
  }, [profile, trendRows])

  const mortalityRate = totalCases > 0 ? (totalDeaths / totalCases) * 100 : 0
  const hasDeaths = trendRows.some((row) => row.deaths > 0)
  const averageCases =
    trendRows.length > 0 ? trendRows.reduce((sum, row) => sum + row.cases, 0) / trendRows.length : 0

  const maxSegmentCount = useMemo(
    () => Math.max(1, ...(profile?.segmentData.map((s) => s.count) ?? [0])),
    [profile]
  )

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
          <strong className={styles.summaryValue}>{formatInteger(trendRows.length)}</strong>
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
            <span className={styles.badge}>{trendRows.length} períodos</span>
          </div>
          <div className={styles.chartBox}>
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
          </div>
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
                            style={{ width: `${(entry.count / maxSegmentCount) * 100}%` }}
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

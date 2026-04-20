import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  CalendarRange,
  Download,
  Filter,
  Gauge,
  ScatterChart as ScatterChartIcon,
  TrendingUp,
  Upload,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { Button } from '@/components/ui/Button/Button'
import { useTheme } from '@/contexts/ThemeContext'
import {
  getActiveChartDatasetId,
  getAllChartDatasets,
  setActiveChartDatasetId,
} from '@/utils/chartDatasets'
import styles from './ChartsPage.module.scss'

type PeriodId = '3m' | '6m' | '12m'

type PeriodOption = {
  id: PeriodId
  label: string
  months: number
}

type StatCard = {
  key: string
  label: string
  value: string
  hint: string
  tone: string
  icon: LucideIcon
  hintTone: 'up' | 'down' | 'neutral'
}

type ChartPalette = {
  surface: string
  border: string
  grid: string
  text: string
  muted: string
  primary: string
  primaryLight: string
  success: string
  warning: string
  danger: string
  info: string
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: '3m', label: '3M', months: 3 },
  { id: '6m', label: '6M', months: 6 },
  { id: '12m', label: '12M', months: 12 },
]

const INTEGER_FORMATTER = new Intl.NumberFormat('pt-BR')
const DECIMAL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
})

const formatInteger = (value: number) => INTEGER_FORMATTER.format(Math.round(value))
const formatPercent = (value: number) => `${DECIMAL_FORMATTER.format(value)}%`

const mean = (values: number[]) => {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const getRiskColor = (risk: string, palette: ChartPalette) => {
  if (risk === 'Alto') return palette.danger
  if (risk === 'Moderado') return palette.warning
  return palette.success
}

const getRiskBarColor = (value: number, palette: ChartPalette) => {
  if (value >= 27) return palette.danger
  if (value >= 20) return palette.warning
  return palette.success
}

export default function ChartsPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()

  const datasets = useMemo(() => getAllChartDatasets(), [])
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(() => {
    const active = getActiveChartDatasetId()
    if (active && datasets.some((dataset) => dataset.id === active)) return active
    return datasets[0]?.id ?? ''
  })
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>('12m')

  const selectedDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId]
  )

  const selectedPeriodConfig =
    PERIOD_OPTIONS.find((period) => period.id === selectedPeriod) ?? PERIOD_OPTIONS[1]

  const chartPalette = useMemo<ChartPalette>(() => {
    const isDarkTheme = theme === 'dark'

    if (typeof window === 'undefined') {
      return {
        surface: isDarkTheme ? '#18181b' : '#fafafa',
        border: isDarkTheme ? '#27272a' : '#e5e5e5',
        grid: isDarkTheme ? '#3f3f46' : '#d4d4d8',
        text: isDarkTheme ? '#fafafa' : '#171717',
        muted: isDarkTheme ? '#a1a1aa' : '#525252',
        primary: '#ff2d55',
        primaryLight: '#ff6482',
        success: '#30d158',
        warning: '#ff9f0a',
        danger: '#ff453a',
        info: '#0a84ff',
      }
    }

    const rootStyles = getComputedStyle(document.body)
    const readToken = (token: string, fallback: string) =>
      rootStyles.getPropertyValue(token).trim() || fallback

    return {
      surface: readToken('--color-surface', '#18181b'),
      border: readToken('--color-border', '#27272a'),
      grid: readToken('--color-border-strong', '#3f3f46'),
      text: readToken('--color-text-primary', '#fafafa'),
      muted: readToken('--color-text-secondary', '#a1a1aa'),
      primary: readToken('--color-primary', '#ff2d55'),
      primaryLight: readToken('--color-primary-light', '#ff6482'),
      success: readToken('--color-success', '#30d158'),
      warning: readToken('--color-warning', '#ff9f0a'),
      danger: readToken('--color-danger', '#ff453a'),
      info: readToken('--color-info', '#0a84ff'),
    }
  }, [theme])

  if (!selectedDataset) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={`gradient-text ${styles.title}`}>Graficos</h1>
            <p className={styles.subtitle}>
              Nenhum dataset disponivel ainda. Faca upload para gerar visualizacoes automaticas.
            </p>
          </div>
        </header>

        <section className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Os graficos sao montados dinamicamente com base nas colunas presentes no arquivo.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => {
              void navigate('/datasets/new')
            }}
          >
            <Upload size={18} />
            <span>Enviar dataset</span>
          </Button>
        </section>
      </div>
    )
  }

  const profile = selectedDataset.profile
  const showTemporalControls = profile.hasTimeDimension && profile.trendData.length > 1
  const trendData = showTemporalControls
    ? profile.trendData.slice(-selectedPeriodConfig.months)
    : profile.trendData
  const visibleTrendData = trendData.length ? trendData : profile.trendData

  const histogramData = profile.histogramData
  const segmentData = profile.segmentData
  const correlationData = profile.correlationData
  const distributionData = profile.distributionData

  const totalRegistros = profile.rowCount
  const pontosAcimaP75 = histogramData.reduce((sum, point) => sum + point.aboveThreshold, 0)
  const mediaPrimaria = Math.round(mean(visibleTrendData.map((point) => point.primary)))
  const mediaFaixaInferior = Math.round(mean(visibleTrendData.map((point) => point.lowShare)))

  const secondaryValues = visibleTrendData
    .map((point) => point.secondary)
    .filter((value): value is number => value !== null)
  const mediaSecundaria = secondaryValues.length ? Math.round(mean(secondaryValues)) : null

  const firstTrendPoint = visibleTrendData[0]
  const lastTrendPoint = visibleTrendData[visibleTrendData.length - 1]
  const variacaoP75 =
    firstTrendPoint && firstTrendPoint.highCount > 0
      ? ((lastTrendPoint.highCount - firstTrendPoint.highCount) / firstTrendPoint.highCount) * 100
      : 0

  const contextHint = showTemporalControls ? 'na janela exibida' : 'nos grupos exibidos'

  const statCards: StatCard[] = [
    {
      key: 'total',
      label: 'Registros analisados',
      value: formatInteger(totalRegistros),
      hint: `${formatInteger(profile.columnCount)} colunas identificadas`,
      tone: chartPalette.info,
      icon: Activity,
      hintTone: 'neutral',
    },
    {
      key: 'primary',
      label: `${profile.primaryMetric} medio`,
      value: formatInteger(mediaPrimaria),
      hint: `media ${contextHint}`,
      tone: chartPalette.primary,
      icon: Gauge,
      hintTone: 'neutral',
    },
    mediaSecundaria !== null
      ? {
          key: 'secondary',
          label: `${profile.secondaryMetric ?? 'Metrica secundaria'} media`,
          value: formatInteger(mediaSecundaria),
          hint: 'comparativo entre metricas numericas',
          tone: chartPalette.success,
          icon: TrendingUp,
          hintTone: 'neutral',
        }
      : {
          key: 'lower-band',
          label: 'Faixa inferior (<= mediana)',
          value: formatPercent(mediaFaixaInferior),
          hint: `sobre ${profile.primaryMetric}`,
          tone: chartPalette.success,
          icon: TrendingUp,
          hintTone: mediaFaixaInferior >= 50 ? 'up' : 'down',
        },
    {
      key: 'above-p75',
      label: 'Registros acima de P75',
      value: formatInteger(pontosAcimaP75),
      hint: `${variacaoP75 >= 0 ? '+' : ''}${DECIMAL_FORMATTER.format(variacaoP75)}% ${contextHint}`,
      tone: chartPalette.warning,
      icon: BarChart3,
      hintTone: variacaoP75 <= 0 ? 'up' : 'down',
    },
  ]

  const tooltipContentStyle = {
    backgroundColor: chartPalette.surface,
    border: `1px solid ${chartPalette.border}`,
    borderRadius: 12,
    color: chartPalette.text,
  }

  const tooltipLabelStyle = {
    color: chartPalette.text,
    fontWeight: 600,
  }

  const legendStyle = {
    color: chartPalette.muted,
    fontSize: 12,
  }

  const hasSecondarySeries =
    Boolean(profile.secondaryMetric) && visibleTrendData.some((point) => point.secondary !== null)
  const hasCorrelation = Boolean(profile.secondaryMetric) && correlationData.length > 0

  const primaryLineName = `${profile.primaryMetric} (media)`
  const secondaryLineName = profile.secondaryMetric
    ? `${profile.secondaryMetric} (media)`
    : 'Metrica secundaria'
  const highCountLineName = 'Acima de P75'

  const trendTitle = profile.hasTimeDimension
    ? 'Evolucao temporal das metricas'
    : `Comparativo por ${profile.groupingDimension}`

  const trendDescription = profile.hasTimeDimension
    ? `Tendencia de ${profile.primaryMetric}${
        profile.secondaryMetric ? `, ${profile.secondaryMetric}` : ''
      } e registros acima do 75o percentil.`
    : `Medias por ${profile.groupingDimension} com destaque para registros acima do 75o percentil.`

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={`gradient-text ${styles.title}`}>Graficos</h1>
          <p className={styles.subtitle}>
            Visualizacoes geradas automaticamente de acordo com a estrutura real do dataset.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button type="button" variant="outline" size="sm" className={styles.headerButton}>
            <Filter size={16} />
            <span>Filtros avancados</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className={styles.headerButton}>
            <Download size={16} />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </header>

      <section className={styles.controlBar} aria-label="Controles da pagina de graficos">
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

        <div className={styles.periodBlock}>
          <span className={styles.controlLabel}>
            <CalendarRange size={14} />
            <span>{showTemporalControls ? 'Janela temporal' : 'Agrupamento detectado'}</span>
          </span>
          {showTemporalControls ? (
            <div className={styles.periodSwitch} role="tablist" aria-label="Selecionar periodo">
              {PERIOD_OPTIONS.map((period) => (
                <button
                  key={period.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedPeriod === period.id}
                  className={`${styles.periodButton} ${
                    selectedPeriod === period.id ? styles.periodButtonActive : ''
                  }`}
                  onClick={() => setSelectedPeriod(period.id)}
                >
                  {period.label}
                </button>
              ))}
            </div>
          ) : (
            <span className={styles.controlLabel}>{profile.groupingDimension}</span>
          )}
        </div>
      </section>

      <section className={styles.statsGrid} aria-label="Resumo rapido de metricas">
        {statCards.map((card) => {
          const Icon = card.icon
          const hintClassName =
            card.hintTone === 'up'
              ? styles.hintUp
              : card.hintTone === 'down'
                ? styles.hintDown
                : styles.hintNeutral

          return (
            <article key={card.key} className={styles.statCard}>
              <span
                className={styles.statIcon}
                style={{
                  color: card.tone,
                  borderColor: `color-mix(in srgb, ${card.tone} 40%, transparent)`,
                  background: `color-mix(in srgb, ${card.tone} 14%, transparent)`,
                }}
              >
                <Icon size={18} />
              </span>
              <div className={styles.statBody}>
                <span className={styles.statLabel}>{card.label}</span>
                <strong className={styles.statValue}>{card.value}</strong>
                <span className={`${styles.statHint} ${hintClassName}`}>{card.hint}</span>
              </div>
            </article>
          )
        })}
      </section>

      <section className={styles.chartsGrid} aria-label="Visualizacoes principais">
        <article className={`${styles.chartCard} ${styles.chartCardLarge}`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWrap}>
              <h2 className={styles.chartTitle}>
                <Activity size={18} className={styles.chartIcon} />
                {trendTitle}
              </h2>
              <p className={styles.chartDescription}>{trendDescription}</p>
            </div>
            <span className={styles.chartBadge}>Linha</span>
          </div>
          <div className={styles.chartViewport}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visibleTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="group"
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value, name) =>
                    typeof value === 'number'
                      ? [formatInteger(value), String(name)]
                      : [String(value), String(name)]
                  }
                />
                <Legend wrapperStyle={legendStyle} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="primary"
                  name={primaryLineName}
                  stroke={chartPalette.primary}
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {hasSecondarySeries && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="secondary"
                    name={secondaryLineName}
                    stroke={chartPalette.info}
                    strokeWidth={2.4}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="highCount"
                  name={highCountLineName}
                  stroke={chartPalette.warning}
                  strokeDasharray="6 4"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWrap}>
              <h2 className={styles.chartTitle}>
                <BarChart3 size={18} className={styles.chartIcon} />
                Percentual acima de P75 por grupo
              </h2>
              <p className={styles.chartDescription}>
                Compara grupos do dataset e mostra o percentual de registros acima do 75o percentil.
              </p>
            </div>
            <span className={styles.chartBadge}>Barras</span>
          </div>
          <div className={styles.chartViewport}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={segmentData}
                layout="vertical"
                margin={{ top: 6, right: 8, left: 0, bottom: 6 }}
              >
                <CartesianGrid
                  stroke={chartPalette.grid}
                  strokeDasharray="3 3"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="segment"
                  width={84}
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value, name) =>
                    typeof value === 'number'
                      ? [formatPercent(value), String(name)]
                      : [String(value), String(name)]
                  }
                />
                <Bar dataKey="ratio" name="Acima de P75" radius={[0, 10, 10, 0]}>
                  {segmentData.map((entry) => (
                    <Cell
                      key={entry.segment}
                      fill={getRiskBarColor(entry.ratio, chartPalette)}
                      stroke="none"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWrap}>
              <h2 className={styles.chartTitle}>
                <BarChart3 size={18} className={styles.chartIcon} />
                Distribuicao de {profile.primaryMetric}
              </h2>
              <p className={styles.chartDescription}>
                Histograma automatico da metrica principal com destaque para valores acima de P75.
              </p>
            </div>
            <span className={styles.chartBadge}>Histograma</span>
          </div>
          <div className={styles.chartViewport}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="bucket"
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke={chartPalette.muted} tickLine={false} axisLine={false} width={38} />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value, name) =>
                    typeof value === 'number'
                      ? [formatInteger(value), String(name)]
                      : [String(value), String(name)]
                  }
                />
                <Legend wrapperStyle={legendStyle} />
                <Bar dataKey="total" name="Total" fill={chartPalette.info} radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="aboveThreshold"
                  name="Acima de P75"
                  fill={chartPalette.danger}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        {hasCorrelation ? (
          <article className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleWrap}>
                <h2 className={styles.chartTitle}>
                  <ScatterChartIcon size={18} className={styles.chartIcon} />
                  Correlacao principal
                </h2>
                <p className={styles.chartDescription}>
                  Relacao entre {profile.primaryMetric} e {profile.secondaryMetric}, com tamanho da
                  bolha baseado em {profile.tertiaryMetric ?? profile.primaryMetric}.
                </p>
              </div>
              <span className={styles.chartBadge}>Scatter</span>
            </div>
            <div className={styles.chartViewport}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={profile.primaryMetric}
                    stroke={chartPalette.muted}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name={profile.secondaryMetric ?? 'Metrica secundaria'}
                    stroke={chartPalette.muted}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <ZAxis
                    type="number"
                    dataKey="size"
                    range={[90, 280]}
                    name={profile.tertiaryMetric ?? profile.primaryMetric}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '4 4' }}
                    contentStyle={tooltipContentStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value, name) =>
                      typeof value === 'number'
                        ? [String(value), String(name)]
                        : [String(value), String(name)]
                    }
                  />
                  <Scatter data={correlationData} dataKey="y">
                    {correlationData.map((entry, index) => (
                      <Cell
                        key={`${entry.x}-${entry.y}-${index}`}
                        fill={getRiskColor(entry.level, chartPalette)}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.scatterLegend}>
              {['Baixo', 'Moderado', 'Alto'].map((risk) => (
                <span key={risk} className={styles.scatterLegendItem}>
                  <span
                    className={styles.scatterLegendDot}
                    style={{ backgroundColor: getRiskColor(risk, chartPalette) }}
                  />
                  {risk}
                </span>
              ))}
            </div>
          </article>
        ) : (
          <article className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleWrap}>
                <h2 className={styles.chartTitle}>
                  <ScatterChartIcon size={18} className={styles.chartIcon} />
                  Correlacao principal
                </h2>
                <p className={styles.chartDescription}>
                  Este dataset nao possui duas metricas numericas suficientes para grafico de
                  correlacao.
                </p>
              </div>
              <span className={styles.chartBadge}>N/A</span>
            </div>
            <div className={styles.chartViewport}>
              <p className={styles.chartDescription}>
                Adicione pelo menos duas colunas numericas para habilitar esta visualizacao.
              </p>
            </div>
          </article>
        )}

        <article className={`${styles.chartCard} ${styles.chartCardLarge}`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWrap}>
              <h2 className={styles.chartTitle}>
                <Gauge size={18} className={styles.chartIcon} />
                Faixa interquartil dos indicadores
              </h2>
              <p className={styles.chartDescription}>
                Visualizacao estilo box-plot para os indicadores numericos mais relevantes.
              </p>
            </div>
            <span className={styles.chartBadge}>Distribuicao</span>
          </div>
          <div className={styles.chartViewport}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={distributionData}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
              >
                <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="indicador"
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke={chartPalette.muted} tickLine={false} axisLine={false} width={38} />
                <Tooltip
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value, name) =>
                    typeof value === 'number'
                      ? [formatInteger(value), String(name)]
                      : [String(value), String(name)]
                  }
                />
                <Legend wrapperStyle={legendStyle} />
                <Bar dataKey="q1" stackId="spread" fill="transparent" name="Q1 (base)" />
                <Bar
                  dataKey="iqr"
                  stackId="spread"
                  fill={chartPalette.primaryLight}
                  name="Faixa Q1-Q3"
                  radius={[10, 10, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="median"
                  name="Mediana"
                  stroke={chartPalette.primary}
                  strokeWidth={2.4}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="min"
                  name="Minimo"
                  stroke={chartPalette.info}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="max"
                  name="Maximo"
                  stroke={chartPalette.warning}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.distributionHint}>
            O perfil e os graficos sao gerados automaticamente a partir da estrutura detectada.
          </p>
        </article>
      </section>
    </div>
  )
}

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

const formatInteger = (value: number) => INTEGER_FORMATTER.format(Math.round(value))

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
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodId>('6m')

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
            <h1 className={`gradient-text ${styles.title}`}>Gráficos</h1>
            <p className={styles.subtitle}>
              Nenhum dataset disponível ainda. Faça upload para gerar visualizações automáticas.
            </p>
          </div>
        </header>

        <section className={styles.emptyState}>
          <p className={styles.emptyStateText}>
            Os gráficos agora são montados a partir de qualquer dataset enviado no upload.
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
  const trendData = profile.trendData.slice(-selectedPeriodConfig.months)
  const histogramData = profile.histogramData
  const regionRiskData = profile.regionRiskData
  const correlationData = profile.correlationData
  const distributionData = profile.distributionData

  const totalRegistros = profile.rowCount
  const casosCriticos = histogramData.reduce((sum, point) => sum + point.critico, 0)
  const mediaPrimaria = Math.round(mean(trendData.map((point) => point.glicemia)))
  const mediaAdesao = Math.round(mean(trendData.map((point) => point.adesao)))

  const firstTrendPoint = trendData[0]
  const lastTrendPoint = trendData[trendData.length - 1]
  const variacaoCriticos =
    firstTrendPoint && firstTrendPoint.internacoes > 0
      ? ((lastTrendPoint.internacoes - firstTrendPoint.internacoes) / firstTrendPoint.internacoes) *
        100
      : 0

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
      label: `${profile.primaryMetric} médio`,
      value: formatInteger(mediaPrimaria),
      hint: 'valor médio na janela atual',
      tone: chartPalette.primary,
      icon: Gauge,
      hintTone: 'neutral',
    },
    {
      key: 'consistency',
      label: 'Consistência por janela',
      value: `${formatInteger(mediaAdesao)}%`,
      hint: mediaAdesao >= 60 ? 'distribuição estável' : 'alta variação entre grupos',
      tone: chartPalette.success,
      icon: TrendingUp,
      hintTone: mediaAdesao >= 60 ? 'up' : 'down',
    },
    {
      key: 'alerts',
      label: 'Pontos críticos',
      value: formatInteger(casosCriticos),
      hint: `${variacaoCriticos >= 0 ? '+' : ''}${variacaoCriticos.toFixed(1)}% na janela`,
      tone: chartPalette.warning,
      icon: BarChart3,
      hintTone: variacaoCriticos <= 0 ? 'up' : 'down',
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

  const primaryLineName = `${profile.primaryMetric} (media)`
  const secondaryLineName = `${profile.secondaryMetric} (media)`
  const criticalLineName = 'Casos críticos'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={`gradient-text ${styles.title}`}>Gráficos</h1>
          <p className={styles.subtitle}>
            Visualização automática para o dataset selecionado, com suporte a arquivos novos e
            estruturas variadas.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button type="button" variant="outline" size="sm" className={styles.headerButton}>
            <Filter size={16} />
            <span>Filtros avançados</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className={styles.headerButton}>
            <Download size={16} />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </header>

      <section className={styles.controlBar} aria-label="Controles da página de gráficos">
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
            <span>Janela temporal</span>
          </span>
          <div className={styles.periodSwitch} role="tablist" aria-label="Selecionar período">
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
        </div>
      </section>

      <section className={styles.statsGrid} aria-label="Resumo rápido de métricas">
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

      <section className={styles.chartsGrid} aria-label="Visualizações principais">
        <article className={`${styles.chartCard} ${styles.chartCardLarge}`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWrap}>
              <h2 className={styles.chartTitle}>
                <Activity size={18} className={styles.chartIcon} />
                Série temporal principal
              </h2>
              <p className={styles.chartDescription}>
                Tendência de {profile.primaryMetric}, {profile.secondaryMetric} e casos críticos ao
                longo da janela selecionada.
              </p>
            </div>
            <span className={styles.chartBadge}>Série temporal</span>
          </div>
          <div className={styles.chartViewport}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
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
                  dataKey="glicemia"
                  name={primaryLineName}
                  stroke={chartPalette.primary}
                  strokeWidth={2.6}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="pressao"
                  name={secondaryLineName}
                  stroke={chartPalette.info}
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="internacoes"
                  name={criticalLineName}
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
                Risco por segmento
              </h2>
              <p className={styles.chartDescription}>
                Percentual de pontos críticos por faixa segmentada do dataset.
              </p>
            </div>
            <span className={styles.chartBadge}>Barras</span>
          </div>
          <div className={styles.chartViewport}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={regionRiskData}
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
                  dataKey="regiao"
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
                      ? [`${value.toFixed(1)}%`, String(name)]
                      : [String(value), String(name)]
                  }
                />
                <Bar dataKey="risco" name="Risco" radius={[0, 10, 10, 0]}>
                  {regionRiskData.map((entry) => (
                    <Cell
                      key={entry.regiao}
                      fill={getRiskBarColor(entry.risco, chartPalette)}
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
                Distribuição de {profile.primaryMetric}
              </h2>
              <p className={styles.chartDescription}>
                Histograma automático da variável primária com destaque para pontos críticos.
              </p>
            </div>
            <span className={styles.chartBadge}>Histograma</span>
          </div>
          <div className={styles.chartViewport}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartPalette.grid} strokeDasharray="3 3" />
                <XAxis
                  dataKey="faixa"
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
                  dataKey="critico"
                  name="Críticos"
                  fill={chartPalette.danger}
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWrap}>
              <h2 className={styles.chartTitle}>
                <ScatterChartIcon size={18} className={styles.chartIcon} />
                Correlação principal
              </h2>
              <p className={styles.chartDescription}>
                Relação entre {profile.primaryMetric} e {profile.secondaryMetric}, com tamanho da
                bolha baseado em {profile.tertiaryMetric}.
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
                  dataKey="imc"
                  name={profile.primaryMetric}
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="glicemia"
                  name={profile.secondaryMetric}
                  stroke={chartPalette.muted}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <ZAxis
                  type="number"
                  dataKey="idade"
                  range={[90, 280]}
                  name={profile.tertiaryMetric}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value, name) =>
                    typeof value === 'number'
                      ? [`${value}`, String(name)]
                      : [String(value), String(name)]
                  }
                />
                <Scatter data={correlationData} dataKey="glicemia">
                  {correlationData.map((entry, index) => (
                    <Cell
                      key={`${entry.imc}-${entry.glicemia}-${index}`}
                      fill={getRiskColor(entry.risco, chartPalette)}
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

        <article className={`${styles.chartCard} ${styles.chartCardLarge}`}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitleWrap}>
              <h2 className={styles.chartTitle}>
                <Gauge size={18} className={styles.chartIcon} />
                Faixa interquartil dos indicadores
              </h2>
              <p className={styles.chartDescription}>
                Visualização estilo box-plot para as métricas mais relevantes encontradas no
                dataset.
              </p>
            </div>
            <span className={styles.chartBadge}>Distribuição</span>
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
                  name="Mínimo"
                  stroke={chartPalette.info}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="max"
                  name="Máximo"
                  stroke={chartPalette.warning}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className={styles.distributionHint}>
            O perfil e os gráficos são gerados automaticamente a partir da estrutura e dos valores
            detectados no upload.
          </p>
        </article>
      </section>
    </div>
  )
}

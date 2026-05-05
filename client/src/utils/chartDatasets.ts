import { getSupabaseAccessToken } from '@/lib/supabase'

type RiskLevel = 'Baixo' | 'Moderado' | 'Alto'

export type ChartDatasetProfile = {
  rowCount: number
  columnCount: number
  primaryMetric: string
  secondaryMetric: string | null
  tertiaryMetric: string | null
  hasTimeDimension: boolean
  groupingDimension: string
  trendData: TrendPoint[]
  histogramData: HistogramPoint[]
  segmentData: SegmentSharePoint[]
  correlationData: CorrelationPoint[]
  distributionData: DistributionPoint[]
  metrics: Record<string, MetricStatistics>
  timeSeriesData: Array<{ date: string; [key: string]: unknown }>
}

export type ChartDatasetRecord = {
  id: string
  profileVersion: number
  name: string
  uploadedAt: string
  sizeBytes: number
  sizeLabel: string
  extension: string
  source: 'seed' | 'upload'
  profile: ChartDatasetProfile
  fieldMapping?: SinanFieldMapping
  sourcePreset?: string | null
}

type RowRecord = Record<string, unknown>
type TrendPoint = {
  group: string
  sampleSize: number
  primary: number
  secondary: number | null
  highCount: number
  lowShare: number
}
type HistogramPoint = {
  bucket: string
  total: number
  aboveThreshold: number
}
type SegmentSharePoint = {
  segment: string
  ratio: number
  count: number
}
type CorrelationPoint = {
  x: number
  y: number
  size: number
  level: RiskLevel
}
type DistributionPoint = {
  indicador: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  iqr: number
}
type GroupedAggregate = {
  primaryValues: number[]
  secondaryValues: number[]
  highCount: number
  lowCount: number
}
type ParsedRowRecord = {
  index: number
  date: Date | null
  trendCategory: string | null
  segmentCategory: string | null
  primary: number
  secondary: number | null
  tertiary: number | null
}
type CategoricalCandidate = {
  column: string
  validCount: number
  valueCount: number
  uniquenessRatio: number
}

const ACTIVE_DATASET_KEY = 'healthlens-active-dataset-id'
const PROFILE_VERSION = 2
const MAX_ROWS_TO_PROFILE = 5000
const MAX_SCATTER_POINTS = 240
const MAX_TREND_GROUPS = 12
const MAX_CATEGORY_VALUES = 40
const MAX_SEGMENT_BARS = 10
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3003'
const MAX_PREVIEW_ROWS = 5000

const safeRound = (value: number, decimals = 0) => {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') return null
  const normalized = value.trim()
  if (!normalized) return null

  const commaDecimal = /^-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(normalized)
  const dotDecimal = /^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(normalized)

  let candidate = normalized
  if (commaDecimal) {
    candidate = normalized.replace(/\./g, '').replace(',', '.')
  } else if (dotDecimal) {
    candidate = normalized.replace(/,/g, '')
  } else {
    candidate = normalized.replace(',', '.')
  }

  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : null
}

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? null : date
  }

  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/[/-]/.test(trimmed) && !/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.valueOf()) ? null : parsed
}

const isValidNumericValue = (
  value: number,
  context: 'age' | 'delay' | 'general' = 'general'
): boolean => {
  if (!Number.isFinite(value)) return false

  // Filter Excel serial numbers, timestamps, and other garbage
  // Excel dates: typically 0-60000 range (1900-2063)
  // Unix timestamps (ms): typically 1000000000000+
  if (value > 100000 || (value > 40000 && value < 50000)) return false

  // Context-specific validation
  if (context === 'age' && (value < 0 || value > 150)) return false
  if (context === 'delay' && (value < 0 || value > 365)) return false

  return true
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${safeRound(bytes / 1024, 1)} KB`
  return `${safeRound(bytes / (1024 * 1024), 1)} MB`
}

const SINAN_CATEGORY_PRIORITY = [
  'cs_sexo',
  'cs_raca',
  'evolucao',
  'classi_fin',
  'criterio',
  'sg_uf_not',
  'sg_uf',
  'id_agravo',
] as const

const getRowDate = (row: RowRecord) =>
  toDate(row.dt_notific) ?? toDate(row.dt_sin_pri) ?? toDate(row.dt_encerra)

const getBestSinanCategoryKey = (rows: RowRecord[]) => {
  for (const key of SINAN_CATEGORY_PRIORITY) {
    const values = rows
      .map((row) => toPlainText(row[key]).trim())
      .filter((value) => value.length > 0 && value.length <= 40)

    const uniqueCount = new Set(values).size
    if (values.length >= Math.max(8, Math.floor(rows.length * 0.2)) && uniqueCount >= 2) {
      return key
    }
  }

  return null
}

const buildHistogramFromValues = (values: number[]) => {
  if (!values.length) {
    return []
  }

  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const bins = Math.min(6, Math.max(3, Math.ceil(Math.sqrt(sorted.length))))
  const span = Math.max(1, max - min)
  const step = span / bins

  return Array.from({ length: bins }, (_, index) => {
    const start = min + step * index
    const end = index === bins - 1 ? max : start + step
    const bucketValues = sorted.filter((value) => {
      if (index === bins - 1) return value >= start && value <= end
      return value >= start && value < end
    })

    return {
      bucket: `${safeRound(start, 1)}-${safeRound(end, 1)}`,
      total: bucketValues.length,
      aboveThreshold: 0,
    }
  })
}

const buildSinanTrendData = (rows: RowRecord[]) => {
  const grouped = new Map<
    string,
    { sortKey: number; label: string; count: number; deaths: number }
  >()

  rows.forEach((row) => {
    const date = getRowDate(row)
    const year =
      date?.getFullYear() ?? (typeof row.nu_ano === 'number' ? Math.trunc(row.nu_ano) : 0)
    const month = date?.getMonth() ?? 0
    const key = date ? `${year}-${String(month + 1).padStart(2, '0')}` : `year-${year}`
    const label = date
      ? `${date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${String(
          date.getFullYear()
        ).slice(-2)}`
      : year
        ? String(year)
        : 'Sem data'
    const current = grouped.get(key)
    const isDeath = Number(toNumber(row.obito) ?? 0) > 0

    if (current) {
      current.count += 1
      current.deaths += isDeath ? 1 : 0
      return
    }

    grouped.set(key, {
      sortKey: date ? date.getTime() : year * 100,
      label,
      count: 1,
      deaths: isDeath ? 1 : 0,
    })
  })

  return Array.from(grouped.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => ({
      group: entry.label,
      sampleSize: entry.count,
      primary: entry.count,
      secondary: entry.deaths,
      highCount: entry.deaths,
      lowShare: entry.count ? safeRound((entry.deaths / entry.count) * 100, 1) : 0,
    }))
    .slice(-12)
}

const buildSinanSegmentData = (rows: RowRecord[]) => {
  const categoryKey = getBestSinanCategoryKey(rows)

  if (!categoryKey) {
    return [] as SegmentSharePoint[]
  }

  const grouped = new Map<string, number>()

  rows.forEach((row) => {
    const value = toPlainText(row[categoryKey]).trim() || 'Nao informado'
    grouped.set(value, (grouped.get(value) ?? 0) + 1)
  })

  const total = Math.max(1, rows.length)

  return Array.from(grouped.entries())
    .map(([segment, count]) => ({
      segment,
      count,
      ratio: safeRound((count / total) * 100, 1),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

const buildSinanDistribution = (label: string, values: number[]) => {
  if (!values.length) return []

  const sorted = [...values].sort((a, b) => a - b)
  const q1 = percentile(sorted, 0.25)
  const median = percentile(sorted, 0.5)
  const q3 = percentile(sorted, 0.75)

  return [
    {
      indicador: label,
      min: safeRound(sorted[0]),
      q1: safeRound(q1),
      median: safeRound(median),
      q3: safeRound(q3),
      max: safeRound(sorted[sorted.length - 1]),
      iqr: safeRound(q3 - q1),
    },
  ]
}

const buildSinanProfileFromRows = (rows: RowRecord[]): ChartDatasetProfile => {
  const rowCount = rows.length
  const columnCount = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>())
  ).length

  const ageValues = rows
    .map((row) => toNumber(row.nu_idade_n))
    .filter((value): value is number => value !== null && isValidNumericValue(value, 'age'))
  const delayValues = rows
    .map((row) => toNumber(row.atraso_notific))
    .filter(
      (value): value is number =>
        value !== null && isValidNumericValue(value, 'delay') && value >= 0
    )
  const closureValues = rows
    .map((row) => toNumber(row.tempo_encerra))
    .filter(
      (value): value is number =>
        value !== null && isValidNumericValue(value, 'delay') && value >= 0
    )
  const deathValues = rows
    .map((row) => toNumber(row.obito))
    .filter((value): value is number => value !== null && (value === 0 || value === 1))

  const dtNotificGroups = buildSinanTrendData(rows)
  const categoryData = buildSinanSegmentData(rows)
  const primaryDateColumn = rows.some((row) => getRowDate(row)) ? 'dt_notific' : 'nu_ano'

  const ageStats = calculateStatistics(ageValues)
  const delayStats = calculateStatistics(delayValues)
  const closureStats = calculateStatistics(closureValues)
  const deathStats = calculateStatistics(deathValues)

  return {
    rowCount,
    columnCount,
    primaryMetric: 'nu_idade_n',
    secondaryMetric: 'atraso_notific',
    tertiaryMetric: 'tempo_encerra',
    hasTimeDimension: dtNotificGroups.length > 1,
    groupingDimension: primaryDateColumn,
    trendData: dtNotificGroups,
    histogramData: buildHistogramFromValues(ageValues),
    segmentData: categoryData,
    correlationData: [],
    distributionData: [
      ...buildSinanDistribution('Idade', ageValues),
      ...buildSinanDistribution('Atraso notificação', delayValues),
      ...buildSinanDistribution('Tempo encerramento', closureValues),
    ],
    metrics: {
      nu_idade_n: ageStats,
      atraso_notific: delayStats,
      tempo_encerra: closureStats,
      obito: deathStats,
    },
    timeSeriesData: dtNotificGroups.map((entry) => ({
      date: entry.group,
      cases: entry.sampleSize,
      deaths: entry.secondary ?? 0,
    })),
  }
}

const buildAuthHeaders = async (): Promise<HeadersInit> => {
  const token = await getSupabaseAccessToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

const toPlainText = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  try {
    const serialized = JSON.stringify(value)
    return serialized ?? ''
  } catch {
    return ''
  }
}

const percentile = (sortedValues: number[], p: number) => {
  if (!sortedValues.length) return 0
  if (sortedValues.length === 1) return sortedValues[0]

  const index = (sortedValues.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  if (low === high) return sortedValues[low]

  const weight = index - low
  return sortedValues[low] * (1 - weight) + sortedValues[high] * weight
}

const mean = (values: number[]) => {
  if (!values.length) return 0
  const total = values.reduce((sum, value) => sum + value, 0)
  return total / values.length
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

const normalizeLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

// SINAN - Sistema de Informação de Agravos de Notificação
export type SinanFieldKey =
  | 'id_agravo'
  | 'nu_ano'
  | 'sem_not'
  | 'dt_notific'
  | 'dt_sin_pri'
  | 'sg_uf_not'
  | 'id_regiona'
  | 'id_municip'
  | 'id_unidade'
  | 'sg_uf'
  | 'id_mn_resi'
  | 'nu_idade_n'
  | 'cs_sexo'
  | 'cs_gestant'
  | 'cs_raca'
  | 'cs_escol_n'
  | 'classi_fin'
  | 'criterio'
  | 'evolucao'
  | 'hospitaliz'
  | 'dt_interna'
  | 'dt_obito'
  | 'dt_encerra'
  | 'obito'
  | 'atraso_notific'
  | 'tempo_encerra'

export type SinanFieldDefinition = {
  key: SinanFieldKey
  label: string
  category: string
  dataType: 'numeric' | 'categorical' | 'temporal'
  derived?: boolean
  required: boolean
  recommended: boolean
}

export type SinanFieldMapping = Partial<Record<SinanFieldKey, string>>

export type MetricStatistics = {
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

export type SinanPreview = {
  columns: string[]
  rows: RowRecord[]
  sampleRows: RowRecord[]
  suggestedMapping: SinanFieldMapping
  supported: boolean
}

export const SINAN_FIELD_DEFINITIONS: SinanFieldDefinition[] = [
  {
    key: 'id_agravo',
    label: 'ID_AGRAVO',
    category: 'Identificação',
    dataType: 'categorical',
    required: true,
    recommended: true,
  },
  {
    key: 'nu_ano',
    label: 'NU_ANO',
    category: 'Notificação',
    dataType: 'temporal',
    required: false,
    recommended: true,
  },
  {
    key: 'sem_not',
    label: 'SEM_NOT',
    category: 'Notificação',
    dataType: 'temporal',
    required: false,
    recommended: true,
  },
  {
    key: 'dt_notific',
    label: 'DT_NOTIFIC',
    category: 'Notificação',
    dataType: 'temporal',
    required: true,
    recommended: true,
  },
  {
    key: 'dt_sin_pri',
    label: 'DT_SIN_PRI',
    category: 'Notificação',
    dataType: 'temporal',
    required: false,
    recommended: true,
  },
  {
    key: 'sg_uf_not',
    label: 'SG_UF_NOT',
    category: 'Localização',
    dataType: 'categorical',
    required: false,
    recommended: true,
  },
  {
    key: 'id_regiona',
    label: 'ID_REGIONA',
    category: 'Localização',
    dataType: 'categorical',
    required: false,
    recommended: true,
  },
  {
    key: 'id_municip',
    label: 'ID_MUNICIP',
    category: 'Localização',
    dataType: 'categorical',
    required: false,
    recommended: true,
  },
  {
    key: 'id_unidade',
    label: 'ID_UNIDADE',
    category: 'Localização',
    dataType: 'categorical',
    required: false,
    recommended: true,
  },
  {
    key: 'sg_uf',
    label: 'SG_UF',
    category: 'Localização',
    dataType: 'categorical',
    required: false,
    recommended: true,
  },
  {
    key: 'id_mn_resi',
    label: 'ID_MN_RESI',
    category: 'Localização',
    dataType: 'categorical',
    required: false,
    recommended: false,
  },
  {
    key: 'nu_idade_n',
    label: 'NU_IDADE_N',
    category: 'Demográfico',
    dataType: 'numeric',
    required: false,
    recommended: true,
  },
  {
    key: 'cs_sexo',
    label: 'CS_SEXO',
    category: 'Demográfico',
    dataType: 'categorical',
    required: false,
    recommended: true,
  },
  {
    key: 'cs_gestant',
    label: 'CS_GESTANT',
    category: 'Demográfico',
    dataType: 'categorical',
    required: false,
    recommended: false,
  },
  {
    key: 'cs_raca',
    label: 'CS_RACA',
    category: 'Demográfico',
    dataType: 'categorical',
    required: false,
    recommended: false,
  },
  {
    key: 'cs_escol_n',
    label: 'CS_ESCOL_N',
    category: 'Demográfico',
    dataType: 'categorical',
    required: false,
    recommended: false,
  },
  {
    key: 'classi_fin',
    label: 'CLASSI_FIN',
    category: 'Clínico',
    dataType: 'categorical',
    required: false,
    recommended: false,
  },
  {
    key: 'criterio',
    label: 'CRITERIO',
    category: 'Clínico',
    dataType: 'categorical',
    required: false,
    recommended: false,
  },
  {
    key: 'evolucao',
    label: 'EVOLUCAO',
    category: 'Desfecho',
    dataType: 'categorical',
    required: false,
    recommended: true,
  },
  {
    key: 'hospitaliz',
    label: 'HOSPITALIZ',
    category: 'Desfecho',
    dataType: 'categorical',
    required: false,
    recommended: false,
  },
  {
    key: 'dt_interna',
    label: 'DT_INTERNA',
    category: 'Desfecho',
    dataType: 'temporal',
    required: false,
    recommended: false,
  },
  {
    key: 'dt_obito',
    label: 'DT_OBITO',
    category: 'Desfecho',
    dataType: 'temporal',
    required: false,
    recommended: false,
  },
  {
    key: 'dt_encerra',
    label: 'DT_ENCERRA',
    category: 'Desfecho',
    dataType: 'temporal',
    required: false,
    recommended: false,
  },
  {
    key: 'obito',
    label: 'OBITO',
    category: 'Derivados',
    dataType: 'categorical',
    derived: true,
    required: false,
    recommended: false,
  },
  {
    key: 'atraso_notific',
    label: 'ATRASO_NOTIFIC',
    category: 'Derivados',
    dataType: 'numeric',
    derived: true,
    required: false,
    recommended: false,
  },
  {
    key: 'tempo_encerra',
    label: 'TEMPO_ENCERRA',
    category: 'Derivados',
    dataType: 'numeric',
    derived: true,
    required: false,
    recommended: false,
  },
]

const SINAN_FIELD_ALIASES: Record<SinanFieldKey, string[]> = {
  id_agravo: ['id_agravo', 'id agravo', 'agravo', 'cid10', 'cid-10', 'cid 10'],
  nu_ano: ['nu_ano', 'ano', 'ano notificacao', 'ano_notificacao', 'year'],
  sem_not: ['sem_not', 'semana not', 'semana epidemiologica', 'semana epi', 'semana notif'],
  dt_notific: [
    'dt_notific',
    'data notific',
    'data notificacao',
    'data notificacao',
    'notification date',
  ],
  dt_sin_pri: ['dt_sin_pri', 'data primeiro sintoma', 'primeiro sintoma', 'symptom date'],
  sg_uf_not: ['sg_uf_not', 'uf notificacao', 'uf not', 'uf_not', 'uf notific'],
  id_regiona: ['id_regiona', 'regional', 'id regional', 'regiao saude'],
  id_municip: ['id_municip', 'id municipio', 'municipio', 'municipio id', 'municipio not'],
  id_unidade: ['id_unidade', 'unidade', 'estabelecimento', 'cnes', 'id unidade'],
  sg_uf: ['sg_uf', 'uf', 'estado', 'sigla uf', 'uf residencia'],
  id_mn_resi: ['id_mn_resi', 'id municipio res', 'municipio residencia', 'mun resid'],
  nu_idade_n: ['nu_idade_n', 'idade', 'idade n', 'idade anos', 'age'],
  cs_sexo: ['cs_sexo', 'sexo', 'sex', 'gender'],
  cs_gestant: ['cs_gestant', 'gestante', 'gestacao', 'gestante status'],
  cs_raca: ['cs_raca', 'raca', 'cor', 'raca cor', 'race'],
  cs_escol_n: ['cs_escol_n', 'escolaridade', 'escola', 'instrucao'],
  classi_fin: ['classi_fin', 'classificacao final', 'classificacao', 'classif'],
  criterio: ['criterio', 'criterio confirmacao', 'criterio confirm', 'criterio caso'],
  evolucao: ['evolucao', 'evolucao caso', 'outcome', 'evolucao paciente'],
  hospitaliz: ['hospitaliz', 'hospitalizacao', 'internacao', 'hospitalizado'],
  dt_interna: ['dt_interna', 'data interna', 'data internacao', 'dt internacao'],
  dt_obito: ['dt_obito', 'data obito', 'obito data', 'death date'],
  dt_encerra: ['dt_encerra', 'dt encerra', 'data encerra', 'data encerramento'],
  obito: [],
  atraso_notific: [],
  tempo_encerra: [],
}

const normalizeMappingToken = (value: string) => normalizeLabel(value).replace(/[^a-z0-9]+/g, ' ')

const columnMatchesAlias = (column: string, alias: string) => {
  const normalizedColumn = normalizeMappingToken(column)
  const normalizedAlias = normalizeMappingToken(alias)

  return (
    normalizedColumn === normalizedAlias ||
    normalizedColumn.includes(normalizedAlias) ||
    normalizedAlias.includes(normalizedColumn)
  )
}

const suggestSinanFieldMapping = (columns: string[]): SinanFieldMapping => {
  const mapping: SinanFieldMapping = {}

  SINAN_FIELD_DEFINITIONS.filter((definition) => !definition.derived).forEach(({ key }) => {
    const aliases = SINAN_FIELD_ALIASES[key]
    const matchedColumn = columns.find((column) =>
      aliases.some((alias) => columnMatchesAlias(column, alias))
    )

    if (matchedColumn) {
      mapping[key] = matchedColumn
    }
  })

  return mapping
}

export const getSinanPreviewFromFile = async (file: File): Promise<SinanPreview> => {
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  const supported = extension === '.csv' || extension === '.json' || extension === '.dbc'

  if (!supported) {
    return {
      columns: [],
      rows: [],
      sampleRows: [],
      suggestedMapping: {},
      supported: false,
    }
  }

  const rows =
    extension === '.dbc' ? await fetchDbcRowsFromServer(file) : await parseRowsFromFile(file)
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>())
  )

  return {
    columns,
    rows,
    sampleRows: rows.slice(0, 5),
    suggestedMapping: suggestSinanFieldMapping(columns),
    supported: true,
  }
}

const getSinanFieldDefinition = (fieldKey: SinanFieldKey) =>
  SINAN_FIELD_DEFINITIONS.find((definition) => definition.key === fieldKey) ?? null

export const getSinanFieldLabel = (fieldKey: SinanFieldKey) =>
  getSinanFieldDefinition(fieldKey)?.label ?? fieldKey

export const getSinanDisplayLabel = (
  rawColumnName: string | null | undefined,
  fieldMapping?: SinanFieldMapping | null
) => {
  if (!rawColumnName) return ''

  const directMatch = SINAN_FIELD_DEFINITIONS.find((definition) => definition.key === rawColumnName)
  if (directMatch) {
    return directMatch.label
  }

  if (fieldMapping) {
    const mappedKey = (Object.entries(fieldMapping).find(
      ([, columnName]) => columnName === rawColumnName
    )?.[0] ?? null) as SinanFieldKey | null

    if (mappedKey) {
      return getSinanFieldLabel(mappedKey)
    }
  }

  return rawColumnName
}

export const applySinanFieldMapping = (
  rows: RowRecord[],
  fieldMapping: SinanFieldMapping
): RowRecord[] => {
  const mappedEntries = Object.entries(fieldMapping).filter(
    (entry): entry is [SinanFieldKey, string] => Boolean(entry[1])
  )

  if (!mappedEntries.length) return []

  return rows.map((row) => {
    const normalizedRow: RowRecord = {}

    mappedEntries.forEach(([fieldKey, sourceColumn]) => {
      if (fieldKey === 'nu_idade_n') {
        normalizedRow[fieldKey] = normalizeSinanAge(row[sourceColumn])
      } else {
        normalizedRow[fieldKey] = row[sourceColumn]
      }
    })

    const evolucao = toPlainText(normalizedRow.evolucao).trim()
    normalizedRow.obito = evolucao === '2' ? 1 : evolucao ? 0 : null

    const dtNotific = toDate(normalizedRow.dt_notific)
    const dtSinPri = toDate(normalizedRow.dt_sin_pri)
    const dtEncerra = toDate(normalizedRow.dt_encerra)

    normalizedRow.atraso_notific = diffInDays(dtNotific, dtSinPri)
    normalizedRow.tempo_encerra = diffInDays(dtEncerra, dtNotific)

    return normalizedRow
  })
}

const MOVING_AVERAGE_WINDOW = 7

const calculateMovingAverage = (values: number[]) => {
  if (!values.length) return 0
  const windowSize = Math.min(values.length, MOVING_AVERAGE_WINDOW)
  const slice = values.slice(-windowSize)
  return mean(slice)
}

// Statistics calculation
const calculateStatistics = (values: number[]): MetricStatistics => {
  const orderedValues = values.filter((v) => Number.isFinite(v))
  if (!orderedValues.length) {
    return {
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
    }
  }

  const sorted = [...orderedValues].sort((a, b) => a - b)
  const n = sorted.length
  const total = sum(orderedValues)
  const media = orderedValues.reduce((a, b) => a + b, 0) / n
  const mediana = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]
  const minimo = sorted[0]
  const maximo = sorted[n - 1]
  const variance = orderedValues.reduce((sumValue, v) => sumValue + Math.pow(v - media, 2), 0) / n
  const desvio_padrao = Math.sqrt(variance)
  const p25 = sorted[Math.floor(n * 0.25)] ?? minimo
  const p75 = sorted[Math.floor(n * 0.75)] ?? maximo
  const variacao_percentual =
    minimo !== 0 ? ((maximo - minimo) / Math.abs(minimo)) * 100 : minimo === maximo ? 0 : 100
  const media_movel = calculateMovingAverage(orderedValues)

  return {
    total: safeRound(total, 2),
    media: safeRound(media, 2),
    media_movel: safeRound(media_movel, 2),
    mediana: safeRound(mediana, 2),
    minimo: safeRound(minimo, 2),
    maximo: safeRound(maximo, 2),
    desvio_padrao: safeRound(desvio_padrao, 2),
    p25: safeRound(p25, 2),
    p75: safeRound(p75, 2),
    variacao_percentual: safeRound(variacao_percentual, 2),
    valores: orderedValues,
  }
}

const normalizeMetricStats = (
  stats: MetricStatistics | undefined,
  context: 'age' | 'delay' | 'general'
): MetricStatistics | undefined => {
  if (!stats) return undefined
  if (!Array.isArray(stats.valores) || !stats.valores.length) return stats

  const filtered = stats.valores.filter((value) => isValidNumericValue(value, context))
  if (!filtered.length) return calculateStatistics([])

  return calculateStatistics(filtered)
}

const normalizeProfileForDisplay = (profile: ChartDatasetProfile): ChartDatasetProfile => {
  const metrics = {
    ...profile.metrics,
    nu_idade_n:
      normalizeMetricStats(profile.metrics.nu_idade_n, 'age') ?? profile.metrics.nu_idade_n,
    atraso_notific:
      normalizeMetricStats(profile.metrics.atraso_notific, 'delay') ??
      profile.metrics.atraso_notific,
    tempo_encerra:
      normalizeMetricStats(profile.metrics.tempo_encerra, 'delay') ?? profile.metrics.tempo_encerra,
    obito: normalizeMetricStats(profile.metrics.obito, 'general') ?? profile.metrics.obito,
  }

  const segmentData = profile.segmentData.map((entry) => {
    const ratio = Number.isFinite(entry.ratio) ? entry.ratio : 0
    const count =
      typeof entry.count === 'number' && Number.isFinite(entry.count)
        ? entry.count
        : Math.round((ratio / 100) * Math.max(1, profile.rowCount))

    return {
      ...entry,
      ratio,
      count,
    }
  })

  return {
    ...profile,
    metrics,
    segmentData,
  }
}

const normalizeSinanAge = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const asString = String(Math.trunc(value))
    return normalizeSinanAge(asString)
  }

  if (typeof value !== 'string') return null
  const digits = value.replace(/\D+/g, '')
  if (!digits) return null
  if (digits.length > 4) return null

  const unit = Number(digits[0])
  const amount = Number(digits.slice(1))
  if (!Number.isFinite(unit) || !Number.isFinite(amount)) return null

  if (unit === 1) return safeRound(amount / (24 * 365), 3)
  if (unit === 2) return safeRound(amount / 365, 3)
  if (unit === 3) return safeRound(amount / 12, 3)
  if (unit === 4) return amount

  return null
}

const diffInDays = (later: Date | null, earlier: Date | null): number | null => {
  if (!later || !earlier) return null
  const diffMs = later.getTime() - earlier.getTime()
  if (!Number.isFinite(diffMs)) return null
  if (diffMs < 0) return null
  return safeRound(diffMs / (1000 * 60 * 60 * 24), 2)
}

const MONTH_LOOKUP: Array<{ index: number; tokens: string[] }> = [
  { index: 0, tokens: ['jan', 'janeiro'] },
  { index: 1, tokens: ['fev', 'fevereiro'] },
  { index: 2, tokens: ['mar', 'marco'] },
  { index: 3, tokens: ['abr', 'abril'] },
  { index: 4, tokens: ['mai', 'maio'] },
  { index: 5, tokens: ['jun', 'junho'] },
  { index: 6, tokens: ['jul', 'julho'] },
  { index: 7, tokens: ['ago', 'agosto'] },
  { index: 8, tokens: ['set', 'setembro'] },
  { index: 9, tokens: ['out', 'outubro'] },
  { index: 10, tokens: ['nov', 'novembro'] },
  { index: 11, tokens: ['dez', 'dezembro'] },
]

const MONTH_SHORT_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

const getMonthIndexFromLabel = (label: string) => {
  const normalized = normalizeLabel(label)
  const tokenized = normalized.replace(/[^a-z0-9]+/g, ' ')

  for (const month of MONTH_LOOKUP) {
    if (month.tokens.some((token) => tokenized === token || tokenized.startsWith(`${token} `))) {
      return month.index
    }
  }

  return -1
}

const getNumericColumnPriority = (column: string) => {
  const normalized = normalizeLabel(column)
  const monthIndex = getMonthIndexFromLabel(normalized)

  if (/\btotal\b/.test(normalized)) return 100
  if (
    /\b(qtd|quantidade|nasc|nascimento|obito|caso|atendimento|internacao|populacao|valor)\b/.test(
      normalized
    )
  )
    return 70
  if (monthIndex >= 0) return 55 - monthIndex
  if (/^\d{4}$/.test(normalized)) return 50
  return 10
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)

const DELIMITER_OPTIONS: Array<',' | ';' | '\t'> = [',', ';', '\t']

const splitCsvRow = (line: string, delimiter: ',' | ';' | '\t') => {
  const values: string[] = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

const findCsvHeaderConfig = (lines: string[]) => {
  const maxLinesToInspect = Math.min(lines.length, 40)

  let bestHeaderIndex = 0
  let bestDelimiter: ',' | ';' | '\t' = ';'
  let bestColumnCount = 1

  for (let index = 0; index < maxLinesToInspect; index += 1) {
    const line = lines[index]
    const bestForLine = DELIMITER_OPTIONS.map((delimiter) => ({
      delimiter,
      columnCount: splitCsvRow(line, delimiter).length,
    })).sort((a, b) => b.columnCount - a.columnCount)[0]

    if (bestForLine.columnCount <= bestColumnCount) continue
    bestHeaderIndex = index
    bestDelimiter = bestForLine.delimiter
    bestColumnCount = bestForLine.columnCount
  }

  return {
    headerIndex: bestHeaderIndex,
    delimiter: bestDelimiter,
    columnCount: bestColumnCount,
  }
}

const parseCsv = (content: string): RowRecord[] => {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const { headerIndex, delimiter, columnCount } = findCsvHeaderConfig(lines)
  if (columnCount < 2) return []

  const headerRow = lines[headerIndex]
  const headerCounts = new Map<string, number>()
  const headers = splitCsvRow(headerRow, delimiter).map((value, index) => {
    const clean = value.replace(/^"|"$/g, '').trim()
    const baseName = clean || `coluna_${index + 1}`
    const occurrences = (headerCounts.get(baseName) ?? 0) + 1
    headerCounts.set(baseName, occurrences)
    return occurrences > 1 ? `${baseName}_${occurrences}` : baseName
  })

  const rows: RowRecord[] = []
  const dataLines = lines.slice(headerIndex + 1)

  dataLines.forEach((line) => {
    const cells = splitCsvRow(line, delimiter).map((cell) => cell.replace(/^"|"$/g, '').trim())
    const firstCell = cells[0] ?? ''
    if (!cells.some((cell) => cell.length > 0)) return
    if (/^(fonte|nota|observacao)\s*:/i.test(firstCell)) return

    const row: RowRecord = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    rows.push(row)
  })

  return rows
}

const parseJsonRows = (content: string): RowRecord[] => {
  const parsed = JSON.parse(content) as unknown

  if (Array.isArray(parsed)) {
    return parsed.filter((item): item is RowRecord => typeof item === 'object' && item !== null)
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const objectValue = parsed as Record<string, unknown>
    const data = objectValue.data

    if (Array.isArray(data)) {
      return data.filter((item): item is RowRecord => typeof item === 'object' && item !== null)
    }

    return [objectValue]
  }

  return []
}

const parseRowsFromFile = async (file: File): Promise<RowRecord[]> => {
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`

  if (extension === '.csv') {
    const content = await file.text()
    return parseCsv(content)
  }

  if (extension === '.json') {
    const content = await file.text()
    return parseJsonRows(content)
  }

  return []
}

const fetchDbcRowsFromServer = async (file: File): Promise<RowRecord[]> => {
  const formData = new FormData()
  formData.append('file', file)

  try {
    const headers = await buildAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/api/datasets/preview`, {
      method: 'POST',
      body: formData,
      headers,
    })

    const payload = (await response.json().catch(() => null)) as { rows?: RowRecord[] } | null

    if (!response.ok || !payload?.rows) return []
    return payload.rows.slice(0, MAX_PREVIEW_ROWS)
  } catch {
    return []
  }
}

const formatGroupLabel = (date: Date) =>
  `${date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${String(
    date.getFullYear()
  ).slice(-2)}`

const buildEmptyProfile = (): ChartDatasetProfile => ({
  rowCount: 0,
  columnCount: 0,
  primaryMetric: 'Sem metrica numerica',
  secondaryMetric: null,
  tertiaryMetric: null,
  hasTimeDimension: false,
  groupingDimension: 'Sem agrupamento',
  trendData: [],
  histogramData: [],
  segmentData: [],
  correlationData: [],
  distributionData: [],
  metrics: {},
  timeSeriesData: [],
})

const buildProfileFromRows = (rowsInput: RowRecord[]): ChartDatasetProfile => {
  const rows = rowsInput.slice(0, MAX_ROWS_TO_PROFILE)
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>())
  )

  if (!rows.length || !columns.length) {
    return buildEmptyProfile()
  }

  const rowCount = rows.length
  const columnCount = columns.length

  const hasSinanFields = rows.some(
    (row) =>
      Object.prototype.hasOwnProperty.call(row, 'nu_idade_n') ||
      Object.prototype.hasOwnProperty.call(row, 'dt_notific') ||
      Object.prototype.hasOwnProperty.call(row, 'evolucao')
  )

  if (hasSinanFields) {
    return buildSinanProfileFromRows(rows)
  }

  // Extract numeric columns
  const numericColumns = columns
    .map((column) => {
      const values = rows
        .map((row) => toNumber(row[column]))
        .filter((value): value is number => value !== null && isValidNumericValue(value, 'general'))
      return {
        column,
        values,
        validCount: values.length,
      }
    })
    .filter((entry) => entry.validCount >= Math.max(2, Math.floor(rowCount * 0.1)))
    .sort((a, b) => b.validCount - a.validCount)

  if (!numericColumns.length) {
    return buildEmptyProfile()
  }

  // Calculate statistics for each numeric column
  const metrics: Record<string, MetricStatistics> = {}
  numericColumns.forEach((entry) => {
    metrics[entry.column] = calculateStatistics(entry.values)
  })

  // Extract time series data if date column exists
  const dateColumn = columns.find((col) => {
    const values = rows.map((row) => toDate(row[col]))
    const validCount = values.filter((v) => v !== null).length
    return validCount >= Math.max(2, Math.floor(rowCount * 0.3))
  })

  const timeSeriesData = (
    dateColumn
      ? rows
          .map((row, idx) => {
            const date = toDate(row[dateColumn])
            if (!date) return null

            const record: { date: string; [key: string]: unknown } = {
              date: date.toISOString(),
              _index: idx,
            }

            numericColumns.forEach((entry) => {
              record[entry.column] = toNumber(row[entry.column])
            })

            return record
          })
          .filter((r): r is { date: string; [key: string]: unknown } => r !== null)
          .slice(0, 1000)
      : []
  ) as Array<{ date: string; [key: string]: unknown }>

  const numericCoverageByColumn = new Map<string, number>()
  const numericSeries = columns
    .map((column) => {
      const series = rows.map((row) => toNumber(row[column]))
      const validCount = series.filter(
        (value): value is number => value !== null && isValidNumericValue(value, 'general')
      ).length
      return { column, series, validCount }
    })
    .filter((entry) => entry.validCount >= Math.max(8, Math.floor(rowCount * 0.3)))
    .sort((a, b) => {
      if (b.validCount !== a.validCount) return b.validCount - a.validCount
      const priorityDiff = getNumericColumnPriority(b.column) - getNumericColumnPriority(a.column)
      if (priorityDiff !== 0) return priorityDiff
      return a.column.localeCompare(b.column, 'pt-BR', { sensitivity: 'base' })
    })

  numericSeries.forEach((entry) => {
    numericCoverageByColumn.set(entry.column, entry.validCount / Math.max(1, rowCount))
  })

  const dateCandidates = columns
    .map((column) => {
      const series = rows.map((row) => toDate(row[column]))
      const validCount = series.filter((value) => value !== null).length
      return { column, series, validCount }
    })
    .filter((entry) => entry.validCount >= Math.max(6, Math.floor(rowCount * 0.4)))
    .sort((a, b) => b.validCount - a.validCount)

  const primaryDateCandidate = dateCandidates[0] ?? null
  const categoricalCandidates = columns
    .filter((column) => column !== primaryDateCandidate?.column)
    .map((column) => {
      const valueCounts = new Map<string, number>()
      let validCount = 0

      rows.forEach((row) => {
        const value = toPlainText(row[column]).trim()
        if (!value || value.length > 80) return

        validCount += 1
        valueCounts.set(value, (valueCounts.get(value) ?? 0) + 1)
      })

      return {
        column,
        validCount,
        valueCount: valueCounts.size,
        uniquenessRatio: valueCounts.size / Math.max(1, validCount),
      }
    })
    .filter((entry) => {
      const numericCoverage = numericCoverageByColumn.get(entry.column) ?? 0
      if (numericCoverage >= 0.7) return false
      if (entry.validCount < Math.max(8, Math.floor(rowCount * 0.25))) return false
      if (entry.valueCount < 2) return false
      return entry.uniquenessRatio < 0.995
    })
    .sort((a, b) => {
      if (b.validCount !== a.validCount) return b.validCount - a.validCount
      if (a.uniquenessRatio !== b.uniquenessRatio) return a.uniquenessRatio - b.uniquenessRatio
      return a.valueCount - b.valueCount
    })

  if (!numericSeries.length) {
    return {
      rowCount,
      columnCount,
      primaryMetric: 'Sem metrica numerica',
      secondaryMetric: null,
      tertiaryMetric: null,
      hasTimeDimension: false,
      groupingDimension: categoricalCandidates[0]?.column ?? 'Sem agrupamento',
      trendData: [],
      histogramData: [],
      segmentData: [],
      correlationData: [],
      distributionData: [],
      metrics,
      timeSeriesData,
    }
  }

  const primarySeries = numericSeries[0]
  const secondarySeries =
    numericSeries.find((entry) => entry.column !== primarySeries.column) ?? null
  const tertiarySeries =
    numericSeries.find(
      (entry) => entry.column !== primarySeries.column && entry.column !== secondarySeries?.column
    ) ?? null

  const primaryLabel = primarySeries.column
  const secondaryLabel = secondarySeries?.column ?? null
  const tertiaryLabel = tertiarySeries?.column ?? null
  const trendCategoryCandidate: CategoricalCandidate | null =
    categoricalCandidates.find(
      (candidate) =>
        candidate.valueCount <= MAX_TREND_GROUPS * 2 &&
        candidate.uniquenessRatio <= 0.9 &&
        candidate.valueCount <= Math.max(2, Math.floor(rowCount * 0.5))
    ) ?? null

  const segmentCategoryCandidate: CategoricalCandidate | null =
    categoricalCandidates.find(
      (candidate) =>
        candidate.valueCount <= Math.max(MAX_SEGMENT_BARS * 12, MAX_CATEGORY_VALUES) &&
        candidate.uniquenessRatio <= 0.97
    ) ?? null

  const categoryForTrendColumn = trendCategoryCandidate?.column ?? null
  const categoryForSegmentColumn = segmentCategoryCandidate?.column ?? null

  const records: ParsedRowRecord[] = rows.map((row, index) => {
    const primaryValue = toNumber(row[primarySeries.column]) ?? 0
    const secondaryValue = secondarySeries ? toNumber(row[secondarySeries.column]) : null
    const tertiaryValue = tertiarySeries ? toNumber(row[tertiarySeries.column]) : null
    const dateValue = primaryDateCandidate ? toDate(row[primaryDateCandidate.column]) : null
    const trendCategoryRaw = categoryForTrendColumn
      ? toPlainText(row[categoryForTrendColumn]).trim()
      : ''
    const segmentCategoryRaw = categoryForSegmentColumn
      ? toPlainText(row[categoryForSegmentColumn]).trim()
      : ''

    return {
      index,
      date: dateValue,
      trendCategory: trendCategoryRaw || null,
      segmentCategory: segmentCategoryRaw || null,
      primary: primaryValue,
      secondary: secondaryValue,
      tertiary: tertiaryValue,
    }
  })

  const monthMetricSeries = numericSeries
    .map((entry) => ({
      ...entry,
      monthIndex: getMonthIndexFromLabel(entry.column),
    }))
    .filter((entry) => entry.monthIndex >= 0)
    .sort((a, b) => a.monthIndex - b.monthIndex)

  const uniqueMonthCount = new Set(monthMetricSeries.map((entry) => entry.monthIndex)).size
  const hasMonthlyLayout = uniqueMonthCount >= 6

  const primarySorted = records.map((item) => item.primary).sort((a, b) => a - b)
  const referenceValues = records.map((item) => item.secondary ?? item.primary)
  const referenceSorted = [...referenceValues].sort((a, b) => a - b)

  const p50Primary = percentile(primarySorted, 0.5)
  const p50Reference = percentile(referenceSorted, 0.5)
  const p75Reference = percentile(referenceSorted, 0.75)
  const getReferenceValue = (record: ParsedRowRecord) => record.secondary ?? record.primary

  let hasTimeDimension = false
  let groupingDimension = 'Faixa amostral'

  const trendData = (() => {
    if (hasMonthlyLayout) {
      hasTimeDimension = true
      groupingDimension = 'Mes'

      return monthMetricSeries.map((entry) => {
        const values = entry.series.filter((value): value is number => value !== null)
        if (!values.length) {
          return {
            group: MONTH_SHORT_LABELS[entry.monthIndex],
            sampleSize: 0,
            primary: 0,
            secondary: null,
            highCount: 0,
            lowShare: 0,
          }
        }

        const sorted = [...values].sort((a, b) => a - b)
        const p50 = percentile(sorted, 0.5)
        const p75 = percentile(sorted, 0.75)

        return {
          group: MONTH_SHORT_LABELS[entry.monthIndex],
          sampleSize: values.length,
          primary: safeRound(sum(values)),
          secondary: null,
          highCount: values.filter((value) => value > p75).length,
          lowShare: safeRound(
            (values.filter((value) => value <= p50).length / values.length) * 100
          ),
        }
      })
    }

    if (primaryDateCandidate) {
      const grouped = new Map<
        string,
        {
          label: string
          aggregate: GroupedAggregate
        }
      >()

      records
        .filter((record) => record.date !== null)
        .sort((a, b) => (a.date?.valueOf() ?? 0) - (b.date?.valueOf() ?? 0))
        .forEach((record) => {
          const date = record.date as Date
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          const current = grouped.get(key)

          if (current) {
            current.aggregate.primaryValues.push(record.primary)
            if (record.secondary !== null) current.aggregate.secondaryValues.push(record.secondary)
            current.aggregate.highCount += getReferenceValue(record) > p75Reference ? 1 : 0
            current.aggregate.lowCount += record.primary <= p50Primary ? 1 : 0
            return
          }

          grouped.set(key, {
            label: formatGroupLabel(date),
            aggregate: {
              primaryValues: [record.primary],
              secondaryValues: record.secondary !== null ? [record.secondary] : [],
              highCount: getReferenceValue(record) > p75Reference ? 1 : 0,
              lowCount: record.primary <= p50Primary ? 1 : 0,
            },
          })
        })

      const groupedValues = Array.from(grouped.values()).slice(-MAX_TREND_GROUPS)
      if (groupedValues.length) {
        hasTimeDimension = groupedValues.length > 1
        groupingDimension = primaryDateCandidate.column
        return groupedValues.map((item) => ({
          group: item.label,
          sampleSize: item.aggregate.primaryValues.length,
          primary: safeRound(mean(item.aggregate.primaryValues)),
          secondary: item.aggregate.secondaryValues.length
            ? safeRound(mean(item.aggregate.secondaryValues))
            : null,
          highCount: item.aggregate.highCount,
          lowShare: safeRound(
            (item.aggregate.lowCount / item.aggregate.primaryValues.length) * 100
          ),
        }))
      }
    }

    if (trendCategoryCandidate) {
      const grouped = new Map<string, GroupedAggregate>()

      records.forEach((record) => {
        const categoryLabel = record.trendCategory ?? 'Nao informado'
        const current = grouped.get(categoryLabel)

        if (current) {
          current.primaryValues.push(record.primary)
          if (record.secondary !== null) current.secondaryValues.push(record.secondary)
          current.highCount += getReferenceValue(record) > p75Reference ? 1 : 0
          current.lowCount += record.primary <= p50Primary ? 1 : 0
          return
        }

        grouped.set(categoryLabel, {
          primaryValues: [record.primary],
          secondaryValues: record.secondary !== null ? [record.secondary] : [],
          highCount: getReferenceValue(record) > p75Reference ? 1 : 0,
          lowCount: record.primary <= p50Primary ? 1 : 0,
        })
      })

      const groupedValues = Array.from(grouped.entries())
        .sort((a, b) => b[1].primaryValues.length - a[1].primaryValues.length)
        .slice(0, MAX_TREND_GROUPS)
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' }))

      if (groupedValues.length) {
        groupingDimension = trendCategoryCandidate.column
        return groupedValues.map(([label, aggregate]) => ({
          group: label,
          sampleSize: aggregate.primaryValues.length,
          primary: safeRound(mean(aggregate.primaryValues)),
          secondary: aggregate.secondaryValues.length
            ? safeRound(mean(aggregate.secondaryValues))
            : null,
          highCount: aggregate.highCount,
          lowShare: safeRound((aggregate.lowCount / aggregate.primaryValues.length) * 100),
        }))
      }
    }

    const slices = MAX_TREND_GROUPS
    const bucketSize = Math.max(1, Math.ceil(records.length / slices))
    const aggregated: TrendPoint[] = []

    for (let start = 0; start < records.length; start += bucketSize) {
      const chunk = records.slice(start, start + bucketSize)
      const lowCount = chunk.filter((item) => item.primary <= p50Primary).length
      const highCount = chunk.filter((item) => getReferenceValue(item) > p75Reference).length
      const secondaryValues = chunk
        .map((item) => item.secondary)
        .filter((value): value is number => value !== null)

      aggregated.push({
        group: `P${aggregated.length + 1}`,
        sampleSize: chunk.length,
        primary: safeRound(mean(chunk.map((item) => item.primary))),
        secondary: secondaryValues.length ? safeRound(mean(secondaryValues)) : null,
        highCount,
        lowShare: safeRound((lowCount / Math.max(1, chunk.length)) * 100),
      })

      if (aggregated.length >= slices) break
    }

    return aggregated
  })()

  const histogramData = (() => {
    const min = primarySorted[0]
    const max = primarySorted[primarySorted.length - 1]
    const bins = 6
    const span = Math.max(1, max - min)
    const step = span / bins

    const histogram = Array.from({ length: bins }, (_, index) => {
      const start = min + step * index
      const end = index === bins - 1 ? max : start + step

      const items = records.filter((record) => {
        if (index === bins - 1) return record.primary >= start && record.primary <= end
        return record.primary >= start && record.primary < end
      })

      return {
        bucket: `${safeRound(start, 1)}-${safeRound(end, 1)}`,
        total: items.length,
        aboveThreshold: items.filter((item) => getReferenceValue(item) > p75Reference).length,
      }
    })

    const hasRealCount = histogram.some((item) => item.total > 0)
    return hasRealCount
      ? histogram
      : [
          {
            bucket: '0-1',
            total: records.length,
            aboveThreshold: records.filter((item) => getReferenceValue(item) > p75Reference).length,
          },
        ]
  })()

  const segmentData = (() => {
    if (segmentCategoryCandidate) {
      const grouped = new Map<string, { total: number; high: number }>()

      records.forEach((record) => {
        const key = record.segmentCategory ?? 'Nao informado'
        const found = grouped.get(key)

        if (found) {
          found.total += 1
          if (getReferenceValue(record) > p75Reference) found.high += 1
          return
        }

        grouped.set(key, {
          total: 1,
          high: getReferenceValue(record) > p75Reference ? 1 : 0,
        })
      })

      const items = Array.from(grouped.entries())
        .map(([segment, counts]) => ({
          segment,
          ratio: counts.total ? safeRound((counts.high / counts.total) * 100, 1) : 0,
          total: counts.total,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, MAX_SEGMENT_BARS)
        .sort((a, b) => b.ratio - a.ratio)

      const maxGroupSize = items.reduce((max, item) => Math.max(max, item.total), 0)
      if (items.length && maxGroupSize > 2) {
        return items.map((item) => ({
          segment: item.segment,
          count: item.total,
          ratio: item.ratio,
        }))
      }
    }

    const slices = 5
    const sortedRecords = [...records].sort((a, b) => a.primary - b.primary)
    const bucketSize = Math.max(1, Math.ceil(sortedRecords.length / slices))

    return Array.from({ length: slices }, (_, index) => {
      const chunk = sortedRecords.slice(index * bucketSize, index * bucketSize + bucketSize)
      const riskRatio = chunk.length
        ? (chunk.filter((item) => getReferenceValue(item) > p75Reference).length / chunk.length) *
          100
        : 0

      return {
        segment: `Q${index + 1}`,
        count: chunk.length,
        ratio: safeRound(riskRatio, 1),
      }
    })
  })()

  const correlationData = (() => {
    if (!secondaryLabel) return [] as CorrelationPoint[]

    const step = Math.max(1, Math.floor(records.length / MAX_SCATTER_POINTS))
    const sampled = records.filter((_, index) => index % step === 0).slice(0, MAX_SCATTER_POINTS)

    return sampled.map((item) => {
      const referenceValue = getReferenceValue(item)
      const risk: RiskLevel =
        referenceValue > p75Reference
          ? 'Alto'
          : referenceValue > p50Reference
            ? 'Moderado'
            : 'Baixo'
      const bubbleSize = clamp(Math.abs(safeRound(item.tertiary ?? item.primary)), 1, 200)

      return {
        x: safeRound(item.primary, 2),
        y: safeRound(referenceValue, 2),
        size: bubbleSize,
        level: risk,
      }
    })
  })()

  const distributionData = (() => {
    const seriesEntries: Array<{ label: string; values: number[] }> = [
      { label: primaryLabel, values: records.map((item) => item.primary) },
    ]

    if (secondaryLabel) {
      seriesEntries.push({
        label: secondaryLabel,
        values: records.map((item) => item.secondary ?? item.primary),
      })
    }

    if (tertiaryLabel) {
      seriesEntries.push({
        label: tertiaryLabel,
        values: records.map((item) => item.tertiary ?? item.primary),
      })
    }

    return seriesEntries
      .map((entry) => {
        const sorted = [...entry.values].sort((a, b) => a - b)
        const min = sorted[0]
        const q1 = percentile(sorted, 0.25)
        const median = percentile(sorted, 0.5)
        const q3 = percentile(sorted, 0.75)
        const max = sorted[sorted.length - 1]

        return {
          indicador: entry.label,
          min: safeRound(min),
          q1: safeRound(q1),
          median: safeRound(median),
          q3: safeRound(q3),
          max: safeRound(max),
          iqr: safeRound(q3 - q1),
        }
      })
      .slice(0, 3)
  })()

  return {
    rowCount,
    columnCount,
    primaryMetric: primaryLabel,
    secondaryMetric: secondaryLabel,
    tertiaryMetric: tertiaryLabel,
    hasTimeDimension,
    groupingDimension,
    trendData,
    histogramData,
    segmentData,
    correlationData,
    distributionData,
    metrics,
    timeSeriesData,
  }
}

type ServerDatasetStats = {
  profile?: unknown
  mapping?: unknown
  preset?: string | null
  fileSizeBytes?: number
  originalName?: string
  mimeType?: string
}

type ServerDatasetRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  stats_json: ServerDatasetStats | null
  row_count: number | null
  column_count: number | null
  created_at: string
  updated_at: string
}

const isValidProfile = (profile: unknown): profile is ChartDatasetProfile => {
  if (typeof profile !== 'object' || profile === null) return false
  const maybe = profile as Partial<ChartDatasetProfile>

  return Boolean(
    typeof maybe.rowCount === 'number' &&
    typeof maybe.columnCount === 'number' &&
    typeof maybe.primaryMetric === 'string' &&
    (typeof maybe.secondaryMetric === 'string' || maybe.secondaryMetric === null) &&
    (typeof maybe.tertiaryMetric === 'string' || maybe.tertiaryMetric === null) &&
    typeof maybe.hasTimeDimension === 'boolean' &&
    typeof maybe.groupingDimension === 'string' &&
    Array.isArray(maybe.trendData) &&
    Array.isArray(maybe.histogramData) &&
    Array.isArray(maybe.segmentData) &&
    Array.isArray(maybe.correlationData) &&
    Array.isArray(maybe.distributionData)
  )
}

const getFileExtension = (fileName: string) => {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1) return '.csv'
  return fileName.slice(lastDotIndex).toLowerCase()
}

const getProfileFromStats = (stats: ServerDatasetStats | null): ChartDatasetProfile | null => {
  if (!stats) return null
  if (isValidProfile(stats)) return normalizeProfileForDisplay(stats)

  if (
    typeof stats.profile === 'object' &&
    stats.profile !== null &&
    isValidProfile(stats.profile)
  ) {
    return normalizeProfileForDisplay(stats.profile)
  }

  return null
}

const toChartDatasetRecord = (row: ServerDatasetRow): ChartDatasetRecord | null => {
  const profile = getProfileFromStats(row.stats_json)
  if (!profile) return null

  const mapping =
    typeof row.stats_json?.mapping === 'object' && row.stats_json.mapping !== null
      ? (row.stats_json.mapping as SinanFieldMapping)
      : undefined

  const fileSizeBytes =
    typeof row.stats_json?.fileSizeBytes === 'number' ? row.stats_json.fileSizeBytes : 0

  return {
    id: row.id,
    profileVersion: PROFILE_VERSION,
    name: row.name,
    uploadedAt: row.created_at,
    sizeBytes: fileSizeBytes,
    sizeLabel: formatFileSize(fileSizeBytes),
    extension: getFileExtension(row.name),
    source: 'upload',
    profile,
    fieldMapping: mapping,
    sourcePreset: typeof row.stats_json?.preset === 'string' ? row.stats_json.preset : null,
  }
}

export const fetchChartDatasets = async (): Promise<ChartDatasetRecord[]> => {
  try {
    const headers = await buildAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/api/datasets`, { headers })
    if (!response.ok) return []

    const payload = (await response.json().catch(() => null)) as {
      datasets?: ServerDatasetRow[]
    } | null

    const uploadedDatasets = (payload?.datasets ?? [])
      .map((row) => toChartDatasetRecord(row))
      .filter((dataset): dataset is ChartDatasetRecord => Boolean(dataset))

    return uploadedDatasets
  } catch {
    return []
  }
}

export const deleteChartDataset = async (datasetId: string): Promise<boolean> => {
  if (!datasetId) return false

  try {
    const headers = await buildAuthHeaders()
    const response = await fetch(`${API_BASE_URL}/api/datasets/${datasetId}`, {
      method: 'DELETE',
      headers,
    })

    return response.ok
  } catch {
    return false
  }
}

export const setActiveChartDatasetId = (datasetId: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_DATASET_KEY, datasetId)
}

export const getActiveChartDatasetId = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_DATASET_KEY)
}

export const createChartDatasetRecordFromFile = async (
  file: File,
  fieldMapping: SinanFieldMapping = {},
  rowsOverride?: RowRecord[]
): Promise<ChartDatasetRecord> => {
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  let profile: ChartDatasetProfile

  try {
    const rows =
      rowsOverride ??
      (extension === '.dbc' ? await fetchDbcRowsFromServer(file) : await parseRowsFromFile(file))
    const mappedRows = applySinanFieldMapping(rows, fieldMapping)
    profile = mappedRows.length ? buildProfileFromRows(mappedRows) : buildEmptyProfile()
  } catch {
    profile = buildEmptyProfile()
  }

  const id = `upload-${Date.now()}-${slugify(file.name)}`
  return {
    id,
    profileVersion: PROFILE_VERSION,
    name: file.name,
    uploadedAt: new Date().toISOString(),
    sizeBytes: file.size,
    sizeLabel: formatFileSize(file.size),
    extension,
    source: 'upload',
    profile,
  }
}

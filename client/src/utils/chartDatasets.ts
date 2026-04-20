type RiskLevel = 'Baixo' | 'Moderado' | 'Alto'

export type TrendPoint = {
  group: string
  sampleSize: number
  primary: number
  secondary: number | null
  highCount: number
  lowShare: number
}

export type HistogramPoint = {
  bucket: string
  total: number
  aboveThreshold: number
}

export type SegmentSharePoint = {
  segment: string
  ratio: number
}

export type CorrelationPoint = {
  x: number
  y: number
  size: number
  level: RiskLevel
}

export type DistributionPoint = {
  indicador: string
  min: number
  q1: number
  median: number
  q3: number
  max: number
  iqr: number
}

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
}

type RowRecord = Record<string, unknown>
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

const STORAGE_KEY = 'healthlens-chart-datasets'
const ACTIVE_DATASET_KEY = 'healthlens-active-dataset-id'
const PROFILE_VERSION = 2
const MAX_ROWS_TO_PROFILE = 5000
const MAX_SCATTER_POINTS = 240
const MAX_TREND_GROUPS = 12
const MAX_CATEGORY_VALUES = 40
const MAX_SEGMENT_BARS = 10

const SEED_DATASETS: Array<{ id: string; name: string; seed: number; sizeBytes: number }> = [
  { id: 'seed-cardio-2023', name: 'Pacientes_Cardio_2023.csv', seed: 17, sizeBytes: 2516582 },
  { id: 'seed-sangue-q1', name: 'Exames_Sangue_Q1.xlsx', seed: 29, sizeBytes: 1153434 },
  { id: 'seed-neuro', name: 'Registros_Neurologia.json', seed: 43, sizeBytes: 5033164 },
]

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

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${safeRound(bytes / 1024, 1)} KB`
  return `${safeRound(bytes / (1024 * 1024), 1)} MB`
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

const pseudoRandom = (seed: number) => {
  let current = seed % 2147483647
  if (current <= 0) current += 2147483646

  return () => {
    current = (current * 16807) % 2147483647
    return (current - 1) / 2147483646
  }
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

const formatGroupLabel = (date: Date) =>
  `${date.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')}/${String(
    date.getFullYear()
  ).slice(-2)}`

const buildSyntheticProfile = (seed: number, metricHint = 'valor'): ChartDatasetProfile => {
  const random = pseudoRandom(seed)
  const trendData: TrendPoint[] = []
  const histogramData: HistogramPoint[] = []
  const segmentData: SegmentSharePoint[] = []
  const correlationData: CorrelationPoint[] = []

  const months = [
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

  for (let index = 0; index < 12; index += 1) {
    const base = 88 + random() * 35
    const secondary = base + 8 + random() * 14

    trendData.push({
      group: months[index],
      sampleSize: Math.round(160 + random() * 220),
      primary: safeRound(base),
      secondary: safeRound(secondary),
      highCount: Math.round(18 + random() * 16),
      lowShare: clamp(Math.round(71 + random() * 21), 40, 99),
    })
  }

  for (let index = 0; index < 6; index += 1) {
    const total = Math.round(70 + random() * 120)
    const aboveThreshold = Math.round(total * (0.12 + random() * 0.22))
    const start = 10 * index

    histogramData.push({
      bucket: `${start}-${start + 9}`,
      total,
      aboveThreshold,
    })
  }

  for (let index = 0; index < 5; index += 1) {
    segmentData.push({
      segment: `Segmento ${index + 1}`,
      ratio: safeRound(14 + random() * 17),
    })
  }

  const lowRiskCut = 98
  const highRiskCut = 118
  for (let index = 0; index < 90; index += 1) {
    const x = safeRound(18 + random() * 18, 1)
    const y = safeRound(80 + random() * 68, 1)
    const age = Math.round(21 + random() * 56)

    const risk: RiskLevel = y > highRiskCut ? 'Alto' : y > lowRiskCut ? 'Moderado' : 'Baixo'
    correlationData.push({
      x,
      y,
      size: age,
      level: risk,
    })
  }

  const distributionData: DistributionPoint[] = [
    { indicador: metricHint, min: 10, q1: 28, median: 42, q3: 58, max: 80, iqr: 30 },
    { indicador: `${metricHint}_2`, min: 18, q1: 36, median: 49, q3: 64, max: 88, iqr: 28 },
    { indicador: `${metricHint}_3`, min: 12, q1: 24, median: 39, q3: 53, max: 79, iqr: 29 },
  ]

  return {
    rowCount: 780,
    columnCount: 11,
    primaryMetric: metricHint,
    secondaryMetric: `${metricHint}_2`,
    tertiaryMetric: `${metricHint}_3`,
    hasTimeDimension: true,
    groupingDimension: 'Mes',
    trendData,
    histogramData,
    segmentData,
    correlationData,
    distributionData,
  }
}

const buildEmptyProfile = (metricHint = 'valor'): ChartDatasetProfile => ({
  rowCount: 0,
  columnCount: 0,
  primaryMetric: metricHint,
  secondaryMetric: null,
  tertiaryMetric: null,
  hasTimeDimension: false,
  groupingDimension: 'Sem agrupamento',
  trendData: [],
  histogramData: [],
  segmentData: [],
  correlationData: [],
  distributionData: [],
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

  const numericCoverageByColumn = new Map<string, number>()
  const numericSeries = columns
    .map((column) => {
      const series = rows.map((row) => toNumber(row[column]))
      const validCount = series.filter((value) => value !== null).length
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
  }
}

const buildSeedDatasetRecord = (
  seed: number,
  id: string,
  name: string,
  sizeBytes: number
): ChartDatasetRecord => {
  const extension = `.${name.split('.').pop()?.toLowerCase() ?? 'csv'}`
  return {
    id,
    profileVersion: PROFILE_VERSION,
    name,
    uploadedAt: '2026-01-10T00:00:00.000Z',
    sizeBytes,
    sizeLabel: formatFileSize(sizeBytes),
    extension,
    source: 'seed',
    profile: buildSyntheticProfile(seed, 'indice'),
  }
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

const readStorage = (): ChartDatasetRecord[] => {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown

    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ChartDatasetRecord => {
      if (typeof item !== 'object' || item === null) return false
      const maybe = item as Partial<ChartDatasetRecord>
      return Boolean(
        maybe.id &&
        maybe.profileVersion === PROFILE_VERSION &&
        maybe.name &&
        maybe.uploadedAt &&
        maybe.extension &&
        maybe.profile &&
        isValidProfile(maybe.profile)
      )
    })
  } catch {
    return []
  }
}

const writeStorage = (datasets: ChartDatasetRecord[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets))
}

export const getSeedDatasets = (): ChartDatasetRecord[] =>
  SEED_DATASETS.map((seed) => buildSeedDatasetRecord(seed.seed, seed.id, seed.name, seed.sizeBytes))

export const getUploadedDatasets = () =>
  readStorage()
    .filter((dataset) => dataset.source === 'upload')
    .sort((a, b) => new Date(b.uploadedAt).valueOf() - new Date(a.uploadedAt).valueOf())

export const getAllChartDatasets = (): ChartDatasetRecord[] => [
  ...getUploadedDatasets(),
  ...getSeedDatasets(),
]

export const setActiveChartDatasetId = (datasetId: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTIVE_DATASET_KEY, datasetId)
}

export const getActiveChartDatasetId = () => {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ACTIVE_DATASET_KEY)
}

export const storeUploadedChartDataset = (record: ChartDatasetRecord) => {
  const current = readStorage().filter((dataset) => dataset.source === 'upload')
  const withoutSame = current.filter((dataset) => dataset.id !== record.id)
  const next = [record, ...withoutSame].slice(0, 30)
  writeStorage(next)
}

export const createChartDatasetRecordFromFile = async (file: File): Promise<ChartDatasetRecord> => {
  const extension = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
  let profile: ChartDatasetProfile

  try {
    const rows = await parseRowsFromFile(file)
    profile = rows.length ? buildProfileFromRows(rows) : buildEmptyProfile()
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

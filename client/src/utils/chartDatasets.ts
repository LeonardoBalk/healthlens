type RiskLevel = 'Baixo' | 'Moderado' | 'Alto'

export type TrendPoint = {
  month: string
  atendimentos: number
  glicemia: number
  pressao: number
  internacoes: number
  adesao: number
}

export type HistogramPoint = {
  faixa: string
  total: number
  critico: number
}

export type RegionRiskPoint = {
  regiao: string
  risco: number
}

export type CorrelationPoint = {
  imc: number
  glicemia: number
  idade: number
  risco: RiskLevel
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
  secondaryMetric: string
  tertiaryMetric: string
  trendData: TrendPoint[]
  histogramData: HistogramPoint[]
  regionRiskData: RegionRiskPoint[]
  correlationData: CorrelationPoint[]
  distributionData: DistributionPoint[]
}

export type ChartDatasetRecord = {
  id: string
  name: string
  uploadedAt: string
  sizeBytes: number
  sizeLabel: string
  extension: string
  source: 'seed' | 'upload'
  profile: ChartDatasetProfile
}

type RowRecord = Record<string, unknown>

const STORAGE_KEY = 'healthlens-chart-datasets'
const ACTIVE_DATASET_KEY = 'healthlens-active-dataset-id'
const MAX_ROWS_TO_PROFILE = 5000
const MAX_SCATTER_POINTS = 240

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

const hashString = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
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

const detectDelimiter = (header: string) => {
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t']
  const scores = candidates.map((delimiter) => ({
    delimiter,
    count: header.split(delimiter).length,
  }))
  scores.sort((a, b) => b.count - a.count)
  return scores[0].delimiter
}

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

const parseCsv = (content: string): RowRecord[] => {
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvRow(lines[0], delimiter).map((value, index) => {
    const clean = value.replace(/^"|"$/g, '').trim()
    return clean || `coluna_${index + 1}`
  })

  return lines.slice(1).map((line) => {
    const cells = splitCsvRow(line, delimiter)
    const row: RowRecord = {}

    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').replace(/^"|"$/g, '').trim()
    })

    return row
  })
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
  const regionRiskData: RegionRiskPoint[] = []
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
    const admissions = 18 + random() * 16

    trendData.push({
      month: months[index],
      atendimentos: Math.round(160 + random() * 220),
      glicemia: safeRound(base),
      pressao: safeRound(secondary),
      internacoes: Math.round(admissions),
      adesao: clamp(Math.round(71 + random() * 21), 40, 99),
    })
  }

  for (let index = 0; index < 6; index += 1) {
    const total = Math.round(70 + random() * 120)
    const critico = Math.round(total * (0.12 + random() * 0.22))
    const start = 10 * index

    histogramData.push({
      faixa: `${start}-${start + 9}`,
      total,
      critico,
    })
  }

  for (let index = 0; index < 5; index += 1) {
    regionRiskData.push({
      regiao: `Segmento ${index + 1}`,
      risco: safeRound(14 + random() * 17),
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
      imc: x,
      glicemia: y,
      idade: age,
      risco: risk,
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
    trendData,
    histogramData,
    regionRiskData,
    correlationData,
    distributionData,
  }
}

const buildProfileFromRows = (rowsInput: RowRecord[]): ChartDatasetProfile => {
  const rows = rowsInput.slice(0, MAX_ROWS_TO_PROFILE)
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>())
  )

  if (!rows.length || !columns.length) {
    return buildSyntheticProfile(11, 'valor')
  }

  const rowCount = rows.length
  const columnCount = columns.length

  const numericSeries = columns
    .map((column) => {
      const series = rows.map((row) => toNumber(row[column]))
      const validCount = series.filter((value) => value !== null).length
      return { column, series, validCount }
    })
    .filter((entry) => entry.validCount >= Math.max(8, Math.floor(rowCount * 0.3)))
    .sort((a, b) => b.validCount - a.validCount)

  const dateCandidates = columns
    .map((column) => {
      const series = rows.map((row) => toDate(row[column]))
      const validCount = series.filter((value) => value !== null).length
      return { column, series, validCount }
    })
    .filter((entry) => entry.validCount >= Math.max(6, Math.floor(rowCount * 0.4)))
    .sort((a, b) => b.validCount - a.validCount)

  if (!numericSeries.length) {
    const fallbackValues = rows.map((row, index) => {
      const base = Object.values(row)
        .map((value) => toPlainText(value).length)
        .reduce((sum, size) => sum + size, 0)

      return base + index * 0.35
    })

    const syntheticRows = fallbackValues.map((value, index) => ({
      valor: value,
      valor_2: value * (1.07 + (index % 4) * 0.02),
      valor_3: value * (0.75 + (index % 3) * 0.04),
      data: index,
    }))

    return buildProfileFromRows(syntheticRows)
  }

  const primarySeries = numericSeries[0]
  const secondarySeries = numericSeries[1] ?? numericSeries[0]
  const tertiarySeries = numericSeries[2] ?? numericSeries[0]

  const primaryLabel = primarySeries.column
  const secondaryLabel =
    secondarySeries.column === primaryLabel ? `${primaryLabel}_2` : secondarySeries.column
  const tertiaryLabel =
    tertiarySeries.column === primaryLabel || tertiarySeries.column === secondarySeries.column
      ? `${primaryLabel}_3`
      : tertiarySeries.column

  const records = rows.map((row, index) => {
    const primaryValue = toNumber(row[primarySeries.column]) ?? 0
    const secondaryValue = toNumber(row[secondarySeries.column]) ?? primaryValue * 1.04
    const tertiaryRaw = toNumber(row[tertiarySeries.column]) ?? primaryValue * 0.64
    const dateValue = dateCandidates.length ? toDate(row[dateCandidates[0].column]) : null

    return {
      index,
      date: dateValue,
      primary: primaryValue,
      secondary: secondaryValue,
      tertiary: tertiaryRaw,
    }
  })

  const primarySorted = records.map((item) => item.primary).sort((a, b) => a - b)
  const secondarySorted = records.map((item) => item.secondary).sort((a, b) => a - b)

  const p50Primary = percentile(primarySorted, 0.5)
  const p50Secondary = percentile(secondarySorted, 0.5)
  const p75Secondary = percentile(secondarySorted, 0.75)

  const trendData = (() => {
    if (dateCandidates.length) {
      const grouped = new Map<
        string,
        {
          label: string
          values: number[]
          values2: number[]
          values3: number[]
          criticalCount: number
          adherenceCount: number
        }
      >()

      records
        .filter((record) => record.date !== null)
        .sort((a, b) => (a.date?.valueOf() ?? 0) - (b.date?.valueOf() ?? 0))
        .forEach((record) => {
          const date = record.date as Date
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          const found = grouped.get(key)

          if (found) {
            found.values.push(record.primary)
            found.values2.push(record.secondary)
            found.values3.push(record.tertiary)
            found.criticalCount += record.secondary > p75Secondary ? 1 : 0
            found.adherenceCount += record.primary <= p50Primary ? 1 : 0
            return
          }

          grouped.set(key, {
            label: formatGroupLabel(date),
            values: [record.primary],
            values2: [record.secondary],
            values3: [record.tertiary],
            criticalCount: record.secondary > p75Secondary ? 1 : 0,
            adherenceCount: record.primary <= p50Primary ? 1 : 0,
          })
        })

      const groupedValues = Array.from(grouped.values()).slice(-12)
      if (!groupedValues.length) return [] as TrendPoint[]

      return groupedValues.map((item) => ({
        month: item.label,
        atendimentos: item.values.length,
        glicemia: safeRound(mean(item.values)),
        pressao: safeRound(mean(item.values2)),
        internacoes: item.criticalCount,
        adesao: safeRound((item.adherenceCount / item.values.length) * 100),
      }))
    }

    const slices = 12
    const bucketSize = Math.max(1, Math.ceil(records.length / slices))
    const aggregated: TrendPoint[] = []

    for (let start = 0; start < records.length; start += bucketSize) {
      const chunk = records.slice(start, start + bucketSize)
      const adherenceCount = chunk.filter((item) => item.primary <= p50Primary).length
      const criticalCount = chunk.filter((item) => item.secondary > p75Secondary).length

      aggregated.push({
        month: `P${aggregated.length + 1}`,
        atendimentos: chunk.length,
        glicemia: safeRound(mean(chunk.map((item) => item.primary))),
        pressao: safeRound(mean(chunk.map((item) => item.secondary))),
        internacoes: criticalCount,
        adesao: safeRound((adherenceCount / Math.max(1, chunk.length)) * 100),
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
        faixa: `${safeRound(start, 1)}-${safeRound(end, 1)}`,
        total: items.length,
        critico: items.filter((item) => item.secondary > p75Secondary).length,
      }
    })

    const hasRealCount = histogram.some((item) => item.total > 0)
    return hasRealCount
      ? histogram
      : [
          {
            faixa: '0-1',
            total: records.length,
            critico: records.filter((item) => item.secondary > p75Secondary).length,
          },
        ]
  })()

  const regionRiskData = (() => {
    const slices = 5
    const bucketSize = Math.max(1, Math.ceil(records.length / slices))

    return Array.from({ length: slices }, (_, index) => {
      const chunk = records.slice(index * bucketSize, index * bucketSize + bucketSize)
      const riskRatio = chunk.length
        ? (chunk.filter((item) => item.secondary > p75Secondary).length / chunk.length) * 100
        : 0

      return {
        regiao: `Segmento ${index + 1}`,
        risco: safeRound(riskRatio, 1),
      }
    })
  })()

  const correlationData = (() => {
    const step = Math.max(1, Math.floor(records.length / MAX_SCATTER_POINTS))
    const sampled = records.filter((_, index) => index % step === 0).slice(0, MAX_SCATTER_POINTS)

    return sampled.map((item) => {
      const risk: RiskLevel =
        item.secondary > p75Secondary
          ? 'Alto'
          : item.secondary > p50Secondary
            ? 'Moderado'
            : 'Baixo'

      return {
        imc: safeRound(item.primary, 2),
        glicemia: safeRound(item.secondary, 2),
        idade: clamp(safeRound(item.tertiary), 1, 120),
        risco: risk,
      }
    })
  })()

  const distributionData = (() => {
    const seriesEntries: Array<{ label: string; values: number[] }> = [
      { label: primaryLabel, values: records.map((item) => item.primary) },
      { label: secondaryLabel, values: records.map((item) => item.secondary) },
      { label: tertiaryLabel, values: records.map((item) => item.tertiary) },
    ]

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
    trendData: trendData.length
      ? trendData
      : buildSyntheticProfile(hashString(primaryLabel)).trendData,
    histogramData,
    regionRiskData,
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
    name,
    uploadedAt: '2026-01-10T00:00:00.000Z',
    sizeBytes,
    sizeLabel: formatFileSize(sizeBytes),
    extension,
    source: 'seed',
    profile: buildSyntheticProfile(seed, 'indice'),
  }
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
        maybe.name &&
        maybe.uploadedAt &&
        maybe.extension &&
        maybe.profile &&
        typeof maybe.profile === 'object'
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
    profile = rows.length
      ? buildProfileFromRows(rows)
      : buildSyntheticProfile(hashString(file.name + file.size))
  } catch {
    profile = buildSyntheticProfile(hashString(file.name + file.size))
  }

  const id = `upload-${Date.now()}-${slugify(file.name)}`
  return {
    id,
    name: file.name,
    uploadedAt: new Date().toISOString(),
    sizeBytes: file.size,
    sizeLabel: formatFileSize(file.size),
    extension,
    source: 'upload',
    profile,
  }
}

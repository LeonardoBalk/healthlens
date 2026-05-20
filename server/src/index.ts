import cors from 'cors'
import dotenv from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import multer from 'multer'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import type { Database, Json } from './lib/database.types'
import { readDbcRecords } from '@precisa-saude/datasus-dbc'
import { supabase } from './lib/supabase'

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(process.cwd(), 'server', '.env'),
]

envPaths.forEach((envPath) => {
  dotenv.config({ path: envPath, override: true })
})

const app = express()
const PORT = process.env.PORT ?? 3003
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.csv', '.json', '.xlsx', '.dbc'])
const MAX_PREVIEW_ROWS = Number.MAX_SAFE_INTEGER
const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'

type RowRecord = Record<string, unknown>
type AuthenticatedRequest = Request & { user?: User }
type DatasetInsert = Database['public']['Tables']['datasets']['Insert']
type DatasetRow = Database['public']['Tables']['datasets']['Row']
type StatsProfile = Record<string, unknown>
type StatsPayload = {
  preset: 'sinan'
  profile?: StatsProfile
  mapping?: Record<string, unknown> | null
  fileSizeBytes: number
  originalName: string
  mimeType: string
  storagePath: string
  storageBucket: string
}

type ChatHistoryMessage = { role: 'user' | 'assistant'; content: string }

type ChatRequestBody = {
  question?: unknown
  summary?: unknown
  datasetName?: unknown
  history?: unknown
}

const SINAN_AGRAVO_NAMES: Record<string, string> = {
  AIDA: 'AIDS/HIV',
  AIDS: 'AIDS/HIV',
  DENG: 'Dengue',
  CHIK: 'Chikungunya',
  ZIKA: 'Zika',
  TUBE: 'Tuberculose',
  SIFI: 'Sífilis',
  LEIV: 'Leishmaniose Visceral',
  LEIS: 'Leishmaniose Tegumentar',
  HEPA: 'Hepatites Virais',
  MALE: 'Malária',
  HANT: 'Hantavirose',
  FEMA: 'Febre Maculosa',
  FEAM: 'Febre Amarela',
  TETA: 'Tétano Acidental',
  COLE: 'Cólera',
  BOTU: 'Botulismo',
  RIBE: 'Raiva Humana',
  ENCE: 'Encefalite Viral',
  ANTR: 'Antraz',
  LEPT: 'Leptospirose',
  MENI: 'Meningite',
  ROTA: 'Rotavirose',
}

const detectSinanAgravo = (filename: string): string | null => {
  const code = filename
    .replace(/\.[^.]+$/, '')
    .slice(0, 4)
    .toUpperCase()
  return SINAN_AGRAVO_NAMES[code] ?? null
}

const buildSystemInstruction = (summary: Record<string, unknown>, datasetName: string) => {
  const agravo = detectSinanAgravo(datasetName)
  const datasetDescription = agravo
    ? `${datasetName} — dados de ${agravo} (SINAN)`
    : `${datasetName} (SINAN)`

  return [
    'Voce e um assistente de dados epidemiologicos especializado no SINAN.',
    'Responda perguntas sobre os dados com base no resumo agregado fornecido.',
    'Para perguntas fora do escopo dos dados, use o contexto da conversa quando disponivel.',
    'Nao invente numeros ou estatisticas que nao estejam no resumo.',
    'Se realmente nao houver informacao suficiente, diga isso claramente.',
    'Responda em pt-BR.',
    'Formate a resposta em texto simples, com quebras de linha.',
    'Use bullets com o simbolo "•" quando listar itens.',
    'Nao use markdown (sem **, sem listas com * ou -).',
    '',
    `Dataset: ${datasetDescription}`,
    'Resumo agregado (JSON):',
    JSON.stringify(summary, null, 2),
  ].join('\n')
}

const buildGeminiContents = (question: string, history: ChatHistoryMessage[]) => {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = history.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))
  contents.push({ role: 'user', parts: [{ text: question }] })
  return contents
}

const extractGeminiAnswer = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || !candidates.length) return null
  const content = (candidates[0] as { content?: unknown }).content
  if (!content || typeof content !== 'object') return null
  const parts = (content as { parts?: unknown }).parts
  if (!Array.isArray(parts) || !parts.length) return null
  const text = parts
    .map((part) =>
      typeof (part as { text?: unknown }).text === 'string' ? (part as { text?: string }).text : ''
    )
    .join('')
    .trim()
  return text || null
}

const parseJsonObject = (value: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null
    }

    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

const parseDbcBuffer = async (buffer: Buffer): Promise<RowRecord[]> => {
  try {
    const bytes = new Uint8Array(buffer)
    const records: RowRecord[] = []

    for await (const record of readDbcRecords(bytes)) {
      if (record && typeof record === 'object') {
        records.push(record as RowRecord)
      }
      if (records.length >= MAX_PREVIEW_ROWS) break
    }

    return records
  } catch (error) {
    console.error('DBC parse error:', error)
    return []
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
})

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas requisições. Tente novamente em instantes.' },
})

// Enable CORS for the frontend origin and allow credentials
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests from the local dev server and null (e.g. from some dev tools)
      const allowed = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
      ]
      if (!origin || allowed.includes(origin)) return callback(null, true)
      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

app.use(express.json())

// Middleware to extract and validate user from Supabase session
app.use(async (req: Request, _res: Response, next: NextFunction) => {
  const typedReq = req as AuthenticatedRequest
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data?.user) {
        console.warn('Auth token validation failed:', error?.message)
      } else {
        typedReq.user = data.user
      }
    } catch (err) {
      console.warn('Auth middleware error:', err)
    }
  }
  next()
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/datasets', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user?.id
    if (!userId) {
      return res.status(401).json({ message: 'Autenticação necessária.' })
    }

    const { data, error } = await supabase
      .from('datasets')
      .select('id,user_id,name,description,stats_json,row_count,column_count,created_at,updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Dataset list error:', error)
      return res
        .status(500)
        .json({ message: 'Falha ao carregar datasets.', error: error.message ?? String(error) })
    }

    return res.json({ datasets: data ?? [] })
  } catch (err) {
    console.error('Dataset list route error:', err)
    return res
      .status(500)
      .json({ message: 'Erro ao buscar datasets.', error: (err as Error).message ?? String(err) })
  }
})

app.post('/api/chat', chatRateLimit, async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id
  if (!userId) {
    return res.status(401).json({ message: 'Autenticacao necessaria.' })
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ message: 'GEMINI_API_KEY nao configurada.' })
  }

  const body = (req.body ?? {}) as ChatRequestBody
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  const summary = body.summary
  const datasetName = typeof body.datasetName === 'string' ? body.datasetName : 'Dataset ativo'

  if (!question) {
    return res.status(400).json({ message: 'Pergunta obrigatoria.' })
  }

  if (!summary || typeof summary !== 'object') {
    return res.status(400).json({ message: 'Resumo agregado obrigatorio.' })
  }

  const rawHistory = Array.isArray(body.history) ? body.history : []
  const history: ChatHistoryMessage[] = rawHistory
    .filter((msg): msg is Record<string, unknown> => typeof msg === 'object' && msg !== null)
    .map((msg) => ({
      role: msg['role'] === 'user' || msg['role'] === 'assistant' ? msg['role'] : 'user',
      content: typeof msg['content'] === 'string' ? msg['content'] : '',
    }))
    .filter((msg) => msg.content.length > 0)
    .slice(-16)

  try {
    const systemInstruction = buildSystemInstruction(
      summary as Record<string, unknown>,
      datasetName
    )
    const contents = buildGeminiContents(question, history)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
          },
        }),
      }
    )

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      console.error('Gemini error:', payload)
      return res.status(500).json({ message: 'Falha ao consultar o Gemini.' })
    }

    const answer = extractGeminiAnswer(payload)
    return res.json({ answer: answer ?? 'Sem resposta do assistente.' })
  } catch (err) {
    console.error('Chat handler error:', err)
    return res.status(500).json({ message: 'Erro ao gerar resposta.' })
  }
})

app.post('/api/datasets/upload', upload.single('file'), async (req: Request, res: Response) => {
  const uploadedFile = req.file
  const userId = (req as AuthenticatedRequest).user?.id

  if (!uploadedFile) {
    return res.status(400).json({ message: 'Nenhum arquivo foi enviado.' })
  }

  if (!userId) {
    return res.status(401).json({ message: 'Autenticação necessária.' })
  }

  const extension = path.extname(uploadedFile.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return res.status(400).json({ message: 'Formato invalido. Use .csv, .json, .xlsx ou .dbc.' })
  }

  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? 'datasets'
  const datasetId = `ds_${randomUUID()}`
  const storagePath = `uploads/${datasetId}${extension}`
  const body = (req.body ?? {}) as Record<string, unknown>
  const rawName = typeof body['name'] === 'string' ? body['name'].trim() : ''
  const customName =
    rawName.length > 0 ? rawName.slice(0, 200) : uploadedFile.originalname.slice(0, 200)
  const profilePayload: string | null = typeof body['profile'] === 'string' ? body['profile'] : null
  const mappingPayload: string | null = typeof body['mapping'] === 'string' ? body['mapping'] : null
  let statsPayload: StatsPayload | null = null
  let parsedMapping: Record<string, unknown> | null = null

  if (mappingPayload) {
    try {
      const candidate = parseJsonObject(mappingPayload)
      if (!candidate) {
        return res.status(400).json({ message: 'Mapping invalido.' })
      }

      const mappedEntries = Object.entries(candidate).filter(
        ([, value]) => typeof value === 'string' && value.trim() !== ''
      )

      if (!mappedEntries.length) {
        return res.status(400).json({ message: 'Mapeie ao menos um campo antes de importar.' })
      }

      parsedMapping = Object.fromEntries(mappedEntries) as Record<string, string>
    } catch {
      return res.status(400).json({ message: 'Mapping invalido.' })
    }
  } else {
    return res.status(400).json({ message: 'Mapeie ao menos um campo antes de importar.' })
  }

  if (profilePayload) {
    try {
      const parsedProfile = parseJsonObject(profilePayload)
      if (!parsedProfile) {
        throw new Error('Invalid profile payload')
      }

      statsPayload = {
        preset: 'sinan',
        profile: parsedProfile,
        mapping: parsedMapping,
        fileSizeBytes: uploadedFile.size,
        originalName: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        storagePath,
        storageBucket: bucket,
      }
    } catch {
      statsPayload = {
        preset: 'sinan',
        fileSizeBytes: uploadedFile.size,
        originalName: uploadedFile.originalname,
        mimeType: uploadedFile.mimetype,
        storagePath,
        storageBucket: bucket,
      }
    }
  }

  try {
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, uploadedFile.buffer, {
        contentType: uploadedFile.mimetype,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return res.status(500).json({
        message: 'Falha ao enviar arquivo para o storage.',
        error: uploadError.message ?? String(uploadError),
      })
    }

    // Insert dataset metadata into DB with user_id
    const insertPayload: DatasetInsert = {
      user_id: userId,
      name: customName,
      description: null,
      stats_json: (statsPayload ?? null) as Json | null,
      row_count:
        statsPayload?.profile && typeof statsPayload.profile.rowCount === 'number'
          ? Number(statsPayload.profile.rowCount)
          : null,
      column_count:
        statsPayload?.profile && typeof statsPayload.profile.columnCount === 'number'
          ? Number(statsPayload.profile.columnCount)
          : null,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('datasets')
      .insert([insertPayload])
      .select()
      .single()

    if (insertError) {
      console.error('DB insert error:', insertError)
      return res.status(500).json({
        message: 'Falha ao gravar metadados no banco.',
        error: insertError.message ?? String(insertError),
      })
    }

    return res.status(201).json({
      message: 'Arquivo recebido e persistido com sucesso.',
      file: {
        originalName: uploadedFile.originalname,
        size: uploadedFile.size,
        mimeType: uploadedFile.mimetype,
        extension,
        storagePath,
      },
      dataset: inserted ?? null,
    })
  } catch (err) {
    console.error('Upload handler error:', err)
    return res.status(500).json({
      message: 'Erro ao processar o upload.',
      error: (err as Error).message ?? String(err),
    })
  }
})

app.post('/api/datasets/preview', upload.single('file'), async (req: Request, res: Response) => {
  const uploadedFile = req.file
  const userId = (req as AuthenticatedRequest).user?.id

  if (!uploadedFile) {
    return res.status(400).json({ message: 'Nenhum arquivo foi enviado.' })
  }

  if (!userId) {
    return res.status(401).json({ message: 'Autenticação necessária.' })
  }

  const extension = path.extname(uploadedFile.originalname).toLowerCase()
  if (extension !== '.dbc') {
    return res.status(400).json({ message: 'Formato invalido para pre-visualizacao.' })
  }

  const rows = await parseDbcBuffer(uploadedFile.buffer)
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>())
  )

  return res.json({ columns, rows })
})

app.delete('/api/datasets/:datasetId', async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id
  if (!userId) {
    return res.status(401).json({ message: 'Autenticação necessária.' })
  }

  const datasetId =
    typeof req.params.datasetId === 'string'
      ? req.params.datasetId
      : Array.isArray(req.params.datasetId)
        ? req.params.datasetId[0]
        : ''
  if (!datasetId) {
    return res.status(400).json({ message: 'Dataset inválido.' })
  }

  try {
    const { data, error } = await supabase
      .from('datasets')
      .select('id,stats_json')
      .eq('id', datasetId)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return res.status(404).json({ message: 'Dataset não encontrado.' })
    }

    const stats = (data as DatasetRow).stats_json as Record<string, unknown> | null
    const storagePath = typeof stats?.storagePath === 'string' ? stats.storagePath : null
    const storageBucket =
      typeof stats?.storageBucket === 'string'
        ? stats.storageBucket
        : (process.env.SUPABASE_STORAGE_BUCKET ?? 'datasets')

    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from(storageBucket)
        .remove([storagePath])
      if (storageError) {
        console.error('Storage delete error:', storageError)
      }
    }

    const { error: deleteError } = await supabase
      .from('datasets')
      .delete()
      .eq('id', datasetId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('DB delete error:', deleteError)
      return res.status(500).json({ message: 'Falha ao excluir dataset.' })
    }

    return res.json({ message: 'Dataset excluído com sucesso.' })
  } catch (err) {
    console.error('Delete dataset error:', err)
    return res.status(500).json({ message: 'Erro ao excluir dataset.' })
  }
})

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res
      .status(400)
      .json({ message: 'Arquivo muito grande. Tamanho maximo permitido: 25 MB.' })
  }

  if (error instanceof Error) {
    return res.status(400).json({ message: error.message })
  }

  return res.status(500).json({ message: 'Erro inesperado ao processar o upload.' })
})

// mantém o Supabase ativo (evita pausa do banco)
const KEEP_ALIVE_INTERVAL = 12 * 60 * 60 * 1000
setInterval(() => {
  void (async () => {
    try {
      const { error } = await supabase.from('datasets').select('id').limit(1)
      if (error) throw error
      console.info('Ping executado com sucesso.')
    } catch (err) {
      console.error('Falha no ping do Supabase:', err)
    }
  })()
}, KEEP_ALIVE_INTERVAL)

app.listen(PORT, () => {
  console.info(`Server running on http://localhost:${PORT}`)
})

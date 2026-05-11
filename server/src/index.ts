import cors from 'cors'
import dotenv from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'node:path'
import type { User } from '@supabase/supabase-js'
import type { Database, Json } from './lib/database.types'
import { readDbcRecords } from '@precisa-saude/datasus-dbc'
import { supabase } from './lib/supabase'

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 3003
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.csv', '.json', '.xlsx', '.dbc'])
const MAX_PREVIEW_ROWS = Number.MAX_SAFE_INTEGER

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
  const datasetId = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const storagePath = `uploads/${datasetId}${extension}`
  const body = (req.body ?? {}) as Record<string, unknown>
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
      name: uploadedFile.originalname,
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

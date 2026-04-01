import cors from 'cors'
import dotenv from 'dotenv'
import express, { type NextFunction, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'node:path'

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 3001
const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.csv', '.json', '.xlsx'])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
})

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/datasets/upload', upload.single('file'), (req, res) => {
  const uploadedFile = req.file

  if (!uploadedFile) {
    return res.status(400).json({ message: 'Nenhum arquivo foi enviado.' })
  }

  const extension = path.extname(uploadedFile.originalname).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return res.status(400).json({ message: 'Formato invalido. Use .csv, .json ou .xlsx.' })
  }

  return res.status(201).json({
    message: 'Arquivo recebido com sucesso.',
    file: {
      originalName: uploadedFile.originalname,
      size: uploadedFile.size,
      mimeType: uploadedFile.mimetype,
      extension,
    },
  })
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

app.listen(PORT, () => {
  console.info(`Server running on http://localhost:${PORT}`)
})

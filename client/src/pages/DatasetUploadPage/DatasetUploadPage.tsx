import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { FileJson, FileSpreadsheet, FileText, LoaderCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import {
  createChartDatasetRecordFromFile,
  setActiveChartDatasetId,
  storeUploadedChartDataset,
} from '@/utils/chartDatasets'
import styles from './DatasetUploadPage.module.scss'

const ACCEPTED_EXTENSIONS = ['.csv', '.json', '.xlsx'] as const
const ACCEPTED_FILE_TYPES_HINT = ACCEPTED_EXTENSIONS.join(', ')
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3001'

type ToastState = {
  message: string
  type: 'success' | 'error'
}

function getFileExtension(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1) return ''
  return fileName.slice(lastDotIndex).toLowerCase()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileTypeLabel(extension: string): string {
  if (extension === '.csv') return 'CSV'
  if (extension === '.json') return 'JSON'
  if (extension === '.xlsx') return 'XLSX'
  return 'Arquivo'
}

function hasFilesInDrop(event: DragEvent<HTMLDivElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

export default function DatasetUploadPage() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragCounterRef = useRef(0)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(() => {
      setToast(null)
    }, 4200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [toast])

  const validateAndSetFile = (file: File | null) => {
    if (!file) return

    const extension = getFileExtension(file.name)
    if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
      setToast({
        type: 'error',
        message: 'Formato invalido. Envie apenas arquivos .csv, .json ou .xlsx.',
      })
      return
    }

    setSelectedFile(file)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    validateAndSetFile(event.target.files?.[0] ?? null)
    event.target.value = ''
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!hasFilesInDrop(event)) return
    dragCounterRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!hasFilesInDrop(event)) return
    event.dataTransfer.dropEffect = 'copy'
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragCounterRef.current = 0
    setIsDragging(false)

    if (!hasFilesInDrop(event)) return
    validateAndSetFile(event.dataTransfer.files?.[0] ?? null)
  }

  const openFilePicker = () => {
    inputRef.current?.click()
  }

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    openFilePicker()
  }

  const handleAnalyze = async () => {
    if (!selectedFile) return

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      setIsSubmitting(true)
      const response = await fetch(`${API_BASE_URL}/api/datasets/upload`, {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json().catch(() => null)) as { message?: string } | null
      if (!response.ok) {
        setToast({
          type: 'error',
          message: payload?.message ?? 'Nao foi possivel enviar o arquivo.',
        })
        return
      }

      setToast({
        type: 'success',
        message: payload?.message ?? 'Arquivo enviado com sucesso.',
      })

      const datasetRecord = await createChartDatasetRecordFromFile(selectedFile)
      storeUploadedChartDataset(datasetRecord)
      setActiveChartDatasetId(datasetRecord.id)
    } catch {
      setToast({
        type: 'error',
        message: 'Falha de conexao com o servidor de upload.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedExtension = selectedFile ? getFileExtension(selectedFile.name) : ''

  return (
    <div className={styles.page}>
      <header className={styles.headingBlock}>
        <h1 className="gradient-text">Upload de Dataset</h1>
        <p className={styles.subtitle}>
          Selecione seu arquivo de dados para iniciar a analise automatica do HealthLens.
        </p>
      </header>

      <div className={styles.stepIndicator} aria-label="Etapas da importacao">
        <span className={`${styles.step} ${styles.stepActive}`}>1-Upload</span>
        <span className={styles.stepSeparator}>&gt;</span>
        <span className={styles.step}>2-Confirmar</span>
        <span className={styles.stepSeparator}>&gt;</span>
        <span className={styles.step}>3-Dashboard</span>
      </div>

      <section className={styles.card}>
        <input
          ref={inputRef}
          type="file"
          className={styles.hiddenInput}
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />

        <div
          role="button"
          tabIndex={0}
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
          onClick={openFilePicker}
          onKeyDown={handleDropzoneKeyDown}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          aria-label="Arraste seu arquivo aqui ou clique para selecionar"
        >
          <span className={styles.uploadIcon}>
            <Upload size={28} />
          </span>
          <p className={styles.dropzoneTitle}>Arraste seu arquivo aqui ou clique para selecionar</p>
          <p className={styles.dropzoneHint}>Formatos suportados: {ACCEPTED_FILE_TYPES_HINT}</p>
        </div>

        {selectedFile && (
          <article className={styles.previewCard}>
            <span className={styles.previewTypeIcon} aria-hidden="true">
              {selectedExtension === '.json' && <FileJson size={20} />}
              {(selectedExtension === '.csv' || selectedExtension === '.xlsx') && (
                <FileSpreadsheet size={20} />
              )}
              {selectedExtension !== '.json' &&
                selectedExtension !== '.csv' &&
                selectedExtension !== '.xlsx' && <FileText size={20} />}
            </span>
            <div className={styles.previewContent}>
              <p className={styles.previewName}>{selectedFile.name}</p>
              <p className={styles.previewMeta}>
                {getFileTypeLabel(selectedExtension)} - {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </article>
        )}

        <div className={styles.actions}>
          <Button
            type="button"
            size="lg"
            className={styles.submitButton}
            disabled={!selectedFile || isSubmitting}
            onClick={() => {
              void handleAnalyze()
            }}
          >
            {isSubmitting && <LoaderCircle className={styles.loadingIcon} size={18} />}
            <span>{isSubmitting ? 'Enviando arquivo...' : 'Analisar com IA'}</span>
          </Button>
        </div>
      </section>

      {toast && (
        <div
          className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}

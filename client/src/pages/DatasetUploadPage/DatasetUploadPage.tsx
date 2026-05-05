import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { FileJson, FileSpreadsheet, FileText, LoaderCircle, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button/Button'
import { getSupabaseAccessToken } from '@/lib/supabase'
import {
  SINAN_FIELD_DEFINITIONS,
  createChartDatasetRecordFromFile,
  getSinanPreviewFromFile,
  setActiveChartDatasetId,
  type SinanFieldDefinition,
  type SinanFieldKey,
  type SinanFieldMapping,
  type SinanPreview,
} from '@/utils/chartDatasets'
import styles from './DatasetUploadPage.module.scss'

const ACCEPTED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.dbc'] as const
const ACCEPTED_FILE_TYPES_HINT = ACCEPTED_EXTENSIONS.join(', ')
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:3003'

type ToastState = {
  message: string
  type: 'success' | 'error'
}

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return '[valor nao serializavel]'
  }
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
  if (extension === '.dbc') return 'DBC'
  return 'Arquivo'
}

function hasFilesInDrop(event: DragEvent<HTMLDivElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

const groupSinanFields = (fields: SinanFieldDefinition[]) =>
  fields.reduce<Record<string, SinanFieldDefinition[]>>((groups, field) => {
    const bucket = groups[field.category] ?? []
    bucket.push(field)
    groups[field.category] = bucket
    return groups
  }, {})

export default function DatasetUploadPage() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const dragCounterRef = useRef(0)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<SinanPreview | null>(null)
  const [fieldMapping, setFieldMapping] = useState<SinanFieldMapping>({})
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
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

  useEffect(() => {
    let isMounted = true

    if (!selectedFile) {
      setPreview(null)
      setFieldMapping({})
      return () => {
        isMounted = false
      }
    }

    const loadPreview = async () => {
      setIsPreviewLoading(true)

      try {
        const nextPreview = await getSinanPreviewFromFile(selectedFile)
        if (!isMounted) return

        setPreview(nextPreview)
        setFieldMapping(nextPreview.suggestedMapping)
      } catch {
        if (!isMounted) return

        setPreview({
          columns: [],
          rows: [],
          sampleRows: [],
          suggestedMapping: {},
          supported: false,
        })
        setFieldMapping({})
      } finally {
        if (isMounted) setIsPreviewLoading(false)
      }
    }

    void loadPreview()

    return () => {
      isMounted = false
    }
  }, [selectedFile])

  const fieldGroups = groupSinanFields(SINAN_FIELD_DEFINITIONS)
  const hasSelectedMapping = Object.values(fieldMapping).some((value) => Boolean(value))

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
    if (!hasSelectedMapping) {
      setToast({
        type: 'error',
        message: 'Mapeie ao menos um campo antes de importar.',
      })
      return
    }

    const datasetRecord = await createChartDatasetRecordFromFile(selectedFile, fieldMapping)
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('profile', JSON.stringify(datasetRecord.profile))
    formData.append('mapping', JSON.stringify(fieldMapping))

    try {
      setIsSubmitting(true)

      const token = await getSupabaseAccessToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${API_BASE_URL}/api/datasets/upload`, {
        method: 'POST',
        body: formData,
        headers,
      })

      const payload = (await response.json().catch(() => null)) as {
        message?: string
        dataset?: { id?: string } | null
      } | null
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

      const payloadDatasetId = payload?.dataset?.id ?? null
      const createdDatasetId =
        typeof payloadDatasetId === 'string' ? payloadDatasetId : datasetRecord.id

      setActiveChartDatasetId(createdDatasetId)
      void navigate('/datasets/charts')
    } catch {
      setToast({
        type: 'error',
        message: 'Falha de conexao com o servidor de upload.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMappingChange = (fieldKey: SinanFieldKey, column: string) => {
    setFieldMapping((current) => ({
      ...current,
      [fieldKey]: column || undefined,
    }))
  }

  const resetToSuggestedMapping = () => {
    if (!preview) return
    setFieldMapping(preview.suggestedMapping)
  }

  const selectedExtension = selectedFile ? getFileExtension(selectedFile.name) : ''

  return (
    <div className={styles.page}>
      <header className={styles.headingBlock}>
        <h1 className="gradient-text">Upload de Dataset Epidemiológico</h1>
        <p className={styles.subtitle}>
          Selecione seu arquivo de dados de doenças virais contagiosas para iniciar a análise
          automatica do HealthLens.
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
          <p className={styles.dropzoneTitle}>
            Arraste seu arquivo epidemiológico aqui ou clique para selecionar
          </p>
          <p className={styles.dropzoneHint}>
            Formatos suportados: {ACCEPTED_FILE_TYPES_HINT} (SINAN / DataSUS)
          </p>
        </div>

        {selectedFile && (
          <article className={styles.previewCard}>
            <span className={styles.previewTypeIcon} aria-hidden="true">
              {selectedExtension === '.json' && <FileJson size={20} />}
              {(selectedExtension === '.csv' ||
                selectedExtension === '.xlsx' ||
                selectedExtension === '.dbc') && <FileSpreadsheet size={20} />}
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

        {selectedFile && (
          <section className={styles.mappingCard} aria-label="Mapeamento SINAN">
            <div className={styles.mappingHeader}>
              <div>
                <h2 className={styles.mappingTitle}>Mapeamento SINAN</h2>
                <p className={styles.mappingSubtitle}>
                  Defina qual coluna do arquivo corresponde a cada campo principal do SINAN.
                </p>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={resetToSuggestedMapping}>
                Usar sugestão
              </Button>
            </div>

            {isPreviewLoading && (
              <p className={styles.mappingStatus}>Lendo colunas do arquivo...</p>
            )}

            {!isPreviewLoading && preview && !preview.supported && (
              <p className={styles.mappingStatus}>
                Prévia automática indisponível para esse formato. Use CSV, JSON ou DBC para
                configurar o field map.
              </p>
            )}

            {!isPreviewLoading && preview?.supported && preview.columns.length === 0 && (
              <p className={styles.mappingStatus}>
                {selectedExtension === '.dbc'
                  ? 'Nao foi possivel ler o arquivo DBC. Confirme se o servidor esta rodando, se a dependencia @precisa-saude/datasus-dbc foi instalada e se voce esta autenticado.'
                  : 'Nao foi possivel detectar colunas no arquivo enviado.'}
              </p>
            )}

            {!isPreviewLoading && preview?.supported && preview.columns.length > 0 && (
              <>
                <p className={styles.mappingStatus}>Apenas os campos mapeados serão importados.</p>

                <div className={styles.columnChips} aria-label="Colunas detectadas">
                  {preview.columns.map((column) => (
                    <span key={column} className={styles.columnChip}>
                      {column}
                    </span>
                  ))}
                </div>

                {preview.sampleRows.length > 0 && (
                  <div className={styles.sampleTableWrapper}>
                    <table className={styles.sampleTable}>
                      <thead>
                        <tr>
                          {preview.columns.slice(0, 6).map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.sampleRows.slice(0, 3).map((row, index) => (
                          <tr key={`${index}-${preview.columns[0] ?? 'row'}`}>
                            {preview.columns.slice(0, 6).map((column) => (
                              <td key={column}>{formatCellValue(row[column])}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className={styles.mappingGroups}>
                  {Object.entries(fieldGroups).map(([category, fields]) => (
                    <div key={category} className={styles.mappingGroup}>
                      <h3 className={styles.mappingGroupTitle}>{category}</h3>

                      <div className={styles.mappingGrid}>
                        {fields.map((field) => (
                          <label key={field.key} className={styles.mappingField}>
                            <span className={styles.mappingFieldLabel}>
                              {field.label}
                              {field.recommended && <strong>Recomendado</strong>}
                            </span>

                            {field.derived ? (
                              <select className={styles.mappingSelect} value="" disabled>
                                <option value="">Gerado automaticamente</option>
                              </select>
                            ) : (
                              <select
                                className={styles.mappingSelect}
                                value={fieldMapping[field.key] ?? ''}
                                onChange={(event) =>
                                  handleMappingChange(field.key, event.target.value)
                                }
                              >
                                <option value="">Não mapear</option>
                                {preview.columns.map((column) => (
                                  <option key={column} value={column}>
                                    {column}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <div className={styles.actions}>
          <Button
            type="button"
            size="lg"
            className={styles.submitButton}
            disabled={!selectedFile || !hasSelectedMapping || isSubmitting}
            onClick={() => {
              void handleAnalyze()
            }}
          >
            {isSubmitting && <LoaderCircle className={styles.loadingIcon} size={18} />}
            <span>{isSubmitting ? 'Enviando arquivo...' : 'Importar Dados Virais'}</span>
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

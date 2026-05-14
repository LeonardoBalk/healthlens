import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ACTIVE_DATASET_CHANGED_EVENT,
  fetchChartDatasets,
  getActiveChartDatasetId,
  setActiveChartDatasetId,
  type ChartDatasetRecord,
} from '@/utils/chartDatasets'

type DatasetContextValue = {
  datasets: ChartDatasetRecord[]
  activeDataset: ChartDatasetRecord | null
  isLoading: boolean
  setActiveDataset: (id: string) => void
  refresh: () => Promise<void>
}

const DatasetContext = createContext<DatasetContextValue | null>(null)

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<ChartDatasetRecord[]>([])
  const [activeId, setActiveId] = useState<string>(getActiveChartDatasetId() ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const activeIdRef = useRef(activeId)

  useEffect(() => {
    activeIdRef.current = activeId
  })

  const refresh = useCallback(async () => {
    setIsLoading(true)
    const loaded = await fetchChartDatasets()
    const sorted = [...loaded].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    setDatasets(sorted)
    const current = getActiveChartDatasetId()
    if (!current || !sorted.some((d) => d.id === current)) {
      const firstId = sorted[0]?.id ?? ''
      if (firstId) setActiveChartDatasetId(firstId)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  useEffect(() => {
    const handle = (e: Event) => {
      const newId = (e as CustomEvent<string>).detail
      if (newId !== activeIdRef.current) setActiveId(newId)
    }
    window.addEventListener(ACTIVE_DATASET_CHANGED_EVENT, handle)
    return () => window.removeEventListener(ACTIVE_DATASET_CHANGED_EVENT, handle)
  }, [])

  const setActiveDataset = useCallback((id: string) => {
    setActiveChartDatasetId(id)
  }, [])

  const activeDataset = datasets.find((d) => d.id === activeId) ?? datasets[0] ?? null

  return (
    <DatasetContext.Provider
      value={{ datasets, activeDataset, isLoading, setActiveDataset, refresh }}
    >
      {children}
    </DatasetContext.Provider>
  )
}

export function useDatasets() {
  const ctx = useContext(DatasetContext)
  if (!ctx) throw new Error('useDatasets must be used within DatasetProvider')
  return ctx
}

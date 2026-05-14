import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/Button/Button'
import { askDatasetChat } from '@/utils/chartDatasets'
import { useDatasets } from '@/contexts/DatasetContext'
import styles from './ChatWidget.module.scss'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'Posso responder perguntas com base nos numeros do dataset ativo.',
}

const formatAssistantContent = (content: string) =>
  content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^\s*[-*]\s+/gm, '• ')

export default function ChatWidget() {
  const { activeDataset } = useDatasets()
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevActiveIdRef = useRef<string | null>(activeDataset?.id ?? null)

  const datasetLabel = activeDataset?.name ?? 'Sem dataset ativo'

  useEffect(() => {
    const currentId = activeDataset?.id ?? null
    if (prevActiveIdRef.current !== null && prevActiveIdRef.current !== currentId) {
      setMessages([INITIAL_MESSAGE])
    }
    prevActiveIdRef.current = currentId
  }, [activeDataset?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  const canSend = input.trim().length > 0 && !isSending

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    const history = messages.slice(1)
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setInput('')

    if (!activeDataset) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Nenhum dataset ativo encontrado.' },
      ])
      return
    }

    setIsSending(true)
    try {
      const answer = await askDatasetChat(trimmed, activeDataset, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            error instanceof Error
              ? `Nao foi possivel responder: ${error.message}`
              : 'Nao foi possivel responder agora.',
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className={styles.wrapper} data-chat-widget>
      {isOpen && (
        <div className={styles.panel} role="dialog" aria-label="Chat com dados">
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.panelLabel}>Chat com dados</span>
              <strong className={styles.panelTitle}>{datasetLabel}</strong>
            </div>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => setIsOpen(false)}
              aria-label="Fechar chat"
            >
              <X size={16} />
            </button>
          </div>

          <div className={styles.messages}>
            {messages.map((message, index) => {
              const formattedContent =
                message.role === 'assistant'
                  ? formatAssistantContent(message.content)
                  : message.content

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`${styles.message} ${
                    message.role === 'user' ? styles.messageUser : styles.messageAssistant
                  }`}
                >
                  {formattedContent}
                </div>
              )
            })}

            {isSending && (
              <div className={`${styles.message} ${styles.messageAssistant} ${styles.typing}`}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputRow}>
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleSend()
                }
              }}
              className={styles.input}
              placeholder="Pergunte sobre o dataset"
              disabled={isSending}
            />
            <Button type="button" size="sm" onClick={() => void handleSend()} disabled={!canSend}>
              <Send size={16} />
              <span>Enviar</span>
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={styles.fab}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Fechar chat' : 'Abrir chat'}
      >
        <MessageCircle size={22} />
      </button>
    </div>
  )
}

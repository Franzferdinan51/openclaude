export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  type?: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'progress' | 'error' | 'system' | 'user' | 'assistant'
  toolName?: string
  toolInput?: Record<string, unknown>
  toolResult?: string
  isLoading?: boolean
}

export interface Session {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}
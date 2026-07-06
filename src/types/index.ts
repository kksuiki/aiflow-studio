// 用户相关类型
export interface User {
  id: string
  username: string
  avatar?: string
  createdAt: string
}

export interface LoginForm {
  username: string
  password: string
}

export interface RegisterForm {
  username: string
  password: string
}

// API响应类型
export interface ApiResponse<T> {
  success: boolean
  code: string
  message: string
  data: T
  timestamp: string
}

// 应用相关类型
export interface Application {
  id: string
  name: string
  description?: string
  icon?: string
  status: 'draft' | 'published' | 'archived'
  shareLink?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAppForm {
  name: string
  description?: string
  icon?: string
}

// 工作流相关类型
export type NodeType = 'start' | 'userInput' | 'llm' | 'rag' | 'skill' | 'condition' | 'output' | 'writeRag'

export interface BaseNodeData {
  label: string
  [key: string]: unknown
}

export interface StartNodeData extends BaseNodeData {
  variables: { key: string; value: any }[]
}

export interface UserInputNodeData extends BaseNodeData {
  inputField: string
}

export interface LLMNodeData extends BaseNodeData {
  model: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
}

export interface RAGNodeData extends BaseNodeData {
  knowledgeBaseId: string
  query: string
  topK: number
  similarityThreshold: number
}

export interface SkillNodeData extends BaseNodeData {
  skillId: string
  skillType: 'builtin' | 'custom'
  parameters: Record<string, any>
}

export interface ConditionNodeData extends BaseNodeData {
  conditions: { variable: string; operator: string; value: any }[]
}

export interface OutputNodeData extends BaseNodeData {
  outputValue: any
}

export interface WriteRagNodeData extends BaseNodeData {
  knowledgeBaseId: string
  content: string
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export type WorkflowNodeData = 
  | StartNodeData 
  | UserInputNodeData 
  | LLMNodeData 
  | RAGNodeData 
  | SkillNodeData 
  | ConditionNodeData 
  | OutputNodeData
  | WriteRagNodeData

export interface WorkflowNode {
  id: string
  type: NodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface Workflow {
  id: string
  name: string
  description?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variables?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// 知识库相关类型
export interface KnowledgeBase {
  id: string
  name: string
  description?: string
  type?: string
  userId: string
  createdAt: string
  updatedAt: string
  documents?: Document[]
}

export interface Document {
  id: string
  name: string
  size: number
  filePath?: string
  knowledgeBaseId: string
  createdAt: string
  updatedAt: string
}

export interface DocumentChunk {
  id: string
  content: string
  chunkIndex: number
  startIndex: number
  endIndex: number
  metadata?: string
  createdAt: string
}

export interface DocumentChunksResponse {
  documentId: string
  documentName: string
  totalChunks: number
  chunks: DocumentChunk[]
}

// Skill工具相关类型
export interface Skill {
  id: string
  name: string
  description?: string
  type: 'builtin' | 'custom'
  builtinType?: string
  config?: Record<string, unknown>
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 聊天消息类型
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  references?: DocumentReference[]
  toolCalls?: ToolCall[]
  createdAt: string
}

export interface DocumentReference {
  documentId: string
  documentName: string
  content: string
  similarity: number
}

export interface ToolCall {
  toolName: string
  params: Record<string, unknown>
  result: unknown
}

// 节点执行状态
export type NodeExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'retrying' | 'timeout'

/** 错误严重程度 */
export type ErrorSeverity = 'warning' | 'error' | 'fatal'

/** 建议的用户操作类型 */
export type UserAction = 'retry' | 'check_config' | 'check_quota' | 'contact_admin' | 'none'

/** 工作流错误码 */
export enum WorkflowErrorCode {
  UNKNOWN = 'UNKNOWN',
  NODE_EXECUTOR_NOT_FOUND = 'NODE_EXECUTOR_NOT_FOUND',
  INVALID_NODE_CONFIG = 'INVALID_NODE_CONFIG',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_API_ERROR = 'LLM_API_ERROR',
  LLM_INVALID_RESPONSE = 'LLM_INVALID_RESPONSE',
  LLM_QUOTA_EXCEEDED = 'LLM_QUOTA_EXCEEDED',
  RAG_EMPTY_RESULT = 'RAG_EMPTY_RESULT',
  RAG_SEARCH_ERROR = 'RAG_SEARCH_ERROR',
  RAG_KB_NOT_FOUND = 'RAG_KB_NOT_FOUND',
  SKILL_EXECUTION_ERROR = 'SKILL_EXECUTION_ERROR',
  SKILL_NOT_FOUND = 'SKILL_NOT_FOUND',
  SKILL_TIMEOUT = 'SKILL_TIMEOUT',
  API_TIMEOUT = 'API_TIMEOUT',
  API_NETWORK_ERROR = 'API_NETWORK_ERROR',
  API_BAD_RESPONSE = 'API_BAD_RESPONSE',
  NODE_TIMEOUT = 'NODE_TIMEOUT',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/** 节点执行时的结构化错误信息 */
export interface NodeErrorInfo {
  errorCode: WorkflowErrorCode
  message: string
  severity: ErrorSeverity
  canRetry: boolean
  userAction?: UserAction
  detail?: string
}

/** 节点执行状态 */
export interface NodeExecution {
  nodeId: string
  status: NodeExecutionStatus
  inputs?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string | NodeErrorInfo
  startedAt?: string
  completedAt?: string
}

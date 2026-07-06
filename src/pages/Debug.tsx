import { useState, useRef, useEffect } from 'react'
import { Typography, Input, Button, Select, Divider, message, Empty } from 'antd'
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  PlayCircleOutlined,
  FileSearchOutlined,
  MessageOutlined,
  NodeIndexOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import { useStore } from '../store'
import request from '../utils/axios'
import { createParser } from 'eventsource-parser'
import './Debug.css'

const { Text, Paragraph } = Typography
const { Option } = Select

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  references?: {
    documentId: string
    documentName: string
    content: string
    similarity: number
  }[]
}

interface NodeExecState {
  nodeId: string
  status: 'running' | 'success' | 'failed' | 'skipped'
  output?: any
  error?: string
}

const CACHE_KEY = 'aiflow_debug_wf_selection'

interface WFCache {
  appId: string
  workflowId: string
}

const loadCache = (): WFCache | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const saveCache = (appId: string, workflowId: string) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ appId, workflowId }))
  } catch { /* ignore */ }
}

/** 将节点 output 格式化为可读文本 */
function formatNodeOutput(output: any): string {
  if (output == null) return ''
  if (typeof output === 'string') return output
  // 优先展示 result 字段（output 节点、writeRag 节点等）
  if (typeof output.result === 'string') return output.result
  if (output.result != null && typeof output.result === 'object') {
    return JSON.stringify(output.result, null, 2)
  }
  return JSON.stringify(output, null, 2)
}

/** 从 finalContext 中提取 output 节点的结果，渲染为纯文本 */
function extractFinalOutput(context: any): string {
  if (!context || typeof context !== 'object') {
    return typeof context === 'string' ? context : JSON.stringify(context, null, 2)
  }
  // 遍历 context 查找 output 类型的节点结果（其 result 为字符串）
  const outputResults: string[] = []
  for (const [key, value] of Object.entries(context)) {
    if (key === '__inputs__') continue
    if (value && typeof value === 'object' && 'result' in (value as any)) {
      const result = (value as any).result
      if (typeof result === 'string' && result.length > 0) {
        outputResults.push(result)
      }
    }
  }
  if (outputResults.length > 0) {
    return outputResults.join('\n\n')
  }
  return JSON.stringify(context, null, 2)
}

const Debug: React.FC = () => {
  const { isLoading, setIsLoading, apps, fetchApps, knowledgeBases, fetchKnowledgeBases } = useStore()
  const [input, setInput] = useState('')
  const isComposingRef = useRef(false) // 标记是否在输入法组合状态
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeTab, setActiveTab] = useState<'chat' | 'workflow'>('chat')
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('')
  const [workflows, setWorkflows] = useState<any[]>([])
  const [selectedKbId, setSelectedKbId] = useState<string>('')
  const [workflowInputsText, setWorkflowInputsText] = useState('{}')
  const [requiredInputFields, setRequiredInputFields] = useState<string[]>([])
  // 逐字段输入值：key = inputField 名，value = 用户输入的字符串
  const [fieldInputs, setFieldInputs] = useState<Record<string, string>>({})
  // 无 userInput 节点时的简单文本输入
  const [simpleInput, setSimpleInput] = useState('')
  const [workflowResult, setWorkflowResult] = useState<any>(null)
  const [nodeStates, setNodeStates] = useState<Record<string, NodeExecState>>({})
  const [wfStatus, setWfStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // 初始化：加载应用列表后，尝试恢复上次的选择
  useEffect(() => {
    const init = async () => {
      await fetchApps()
      fetchKnowledgeBases()
      const cache = loadCache()
      if (cache?.appId) {
        // 恢复应用选择并加载工作流列表
        setSelectedAppId(cache.appId)
        try {
          const response = await request.get(`/workflows/app/${cache.appId}`) as any
          const wfList = response.data || []
          setWorkflows(wfList)
          // 验证缓存的 workflowId 仍然存在
          if (cache.workflowId && wfList.some((w: any) => w.id === cache.workflowId)) {
            // 直接复用 handleWorkflowChange 逻辑
            setSelectedWorkflowId(cache.workflowId)
            try {
              const wfResp = await request.get(`/workflows/${cache.workflowId}`) as any
              const wfData = wfResp.data || wfResp
              const nodes: any[] = Array.isArray(wfData.nodes) ? wfData.nodes : []
              const fields: string[] = []
              for (const node of nodes) {
                if (node.type === 'userInput' && node.data?.inputField) {
                  fields.push(node.data.inputField)
                }
              }
              setRequiredInputFields(fields)
              if (fields.length > 0) {
                const initValues: Record<string, string> = {}
                fields.forEach(f => { initValues[f] = '' })
                setFieldInputs(initValues)
              }
            } catch { /* 获取详情失败时忽略，工作流选择仍有效 */ }
          }
        } catch { /* 获取工作流列表失败时忽略 */ }
      }
    }
    init()
  }, [fetchApps, fetchKnowledgeBases])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamingContent])

  const handleAppChange = async (appId: string) => {
    setSelectedAppId(appId)
    setSelectedWorkflowId('')
    setWorkflows([])
    setWorkflowInputsText('{}')
    setRequiredInputFields([])
    setFieldInputs({})
    setSimpleInput('')
    // 切换应用时清除 workflowId 缓存
    if (appId) saveCache(appId, '')
    if (appId) {
      try {
        const response = await request.get(`/workflows/app/${appId}`) as any
        setWorkflows(response.data || [])
      } catch {
        message.error('获取工作流失败')
      }
    }
  }

  // 选择工作流时，获取详情并自动预填充 UserInput 节点所需的输入参数
  const handleWorkflowChange = async (workflowId: string) => {
    setSelectedWorkflowId(workflowId)
    // 保存缓存
    saveCache(selectedAppId, workflowId)
    if (!workflowId) {
      setWorkflowInputsText('{}')
      setRequiredInputFields([])
      return
    }
    try {
      const response = await request.get(`/workflows/${workflowId}`) as any
      const wfData = response.data || response
      const nodes: any[] = Array.isArray(wfData.nodes) ? wfData.nodes : []
      // 找出所有 UserInput 节点，提取 inputField 作为预填充的 key
      const fields: string[] = []
      for (const node of nodes) {
        if (node.type === 'userInput' && node.data?.inputField) {
          fields.push(node.data.inputField)
        }
      }
      setRequiredInputFields(fields)
      if (fields.length > 0) {
        const initValues: Record<string, string> = {}
        fields.forEach(f => { initValues[f] = '' })
        setFieldInputs(initValues)
        setWorkflowInputsText('{}')
      } else {
        setFieldInputs({})
        setSimpleInput('')
        setWorkflowInputsText('{}')
      }
    } catch (err) {
      console.error('获取工作流详情失败:', err)
      setWorkflowInputsText('{}')
      setRequiredInputFields([])
      setFieldInputs({})
      setSimpleInput('')
    }
  }

  const handleSendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    // 立即清空输入框并设置流式状态
    const currentInput = trimmed
    setInput('')
    setIsStreaming(true)
    setStreamingContent('')

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
      createdAt: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])

    const assistantMessageId = Date.now().toString() + '-assistant'

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          message: currentInput,
          history: messages.map(msg => ({ role: msg.role, content: msg.content })),
          ...(selectedKbId ? { knowledgeBaseId: selectedKbId } : {}),
        }),
      })

      if (!response.ok) throw new Error('API request failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      let accumulatedContent = ''
      let references: any[] = []

      const parser = createParser((event) => {
        if (event.type === 'event') {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'text') {
              accumulatedContent += data.content
              setStreamingContent(accumulatedContent)
            } else if (data.type === 'done') {
              references = data.references || []
              setMessages(prev => [
                ...prev,
                {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: accumulatedContent,
                  createdAt: new Date().toISOString(),
                  references,
                },
              ])
              setIsStreaming(false)
              setStreamingContent('')
            } else if (data.type === 'error') {
              message.error(data.message || '对话出错')
              setIsStreaming(false)
              setStreamingContent('')
            }
          } catch (e) {
            console.error('SSE parse error', e)
          }
        }
      })

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value))
      }

      // 流结束但没收到 done 事件：将已有内容保存为消息
      if (isStreaming && accumulatedContent) {
        setMessages(prev => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: accumulatedContent,
            createdAt: new Date().toISOString(),
          },
        ])
      }
      setIsStreaming(false)
      setStreamingContent('')
    } catch {
      message.error('发送消息失败')
      setIsStreaming(false)
      setStreamingContent('')
    }
  }

  const handleRunWorkflow = async () => {
    if (!selectedWorkflowId) {
      message.error('请选择工作流')
      return
    }

    let inputs: Record<string, any> = {}
    if (requiredInputFields.length > 0) {
      // userInput 字段，支持类型自动转换（如 "true" → true）
      const missing = requiredInputFields.filter(f => !fieldInputs[f] || fieldInputs[f].trim() === '')
      if (missing.length > 0) {
        message.error(`请填写必填参数：${missing.join(', ')}`)
        return
      }
      requiredInputFields.forEach(f => {
        const raw = fieldInputs[f].trim()
        if (raw === 'true') inputs[f] = true
        else if (raw === 'false') inputs[f] = false
        else if (!isNaN(Number(raw)) && raw !== '') inputs[f] = Number(raw)
        else inputs[f] = raw
      })
    } else {
      // 无 userInput 节点：用简单文本框，包装为 { input: '...' }
      if (simpleInput.trim()) {
        inputs = { input: simpleInput.trim() }
      }
      // 如果 simpleInput 为空但 workflowInputsText 不是 '{}'，尝试解析 JSON（高级用户手动填写）
      else if (workflowInputsText.trim() !== '{}') {
        try {
          inputs = JSON.parse(workflowInputsText)
        } catch {
          message.error('输入参数 JSON 格式错误')
          return
        }
      }
    }

    setIsLoading(true)
    setWorkflowResult(null)
    setNodeStates({})
    setWfStatus('running')

    try {
      const response = await fetch(`/api/workflows/${selectedWorkflowId}/run/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ inputs }),
      })

      if (!response.ok) throw new Error('Workflow execution failed')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const parser = createParser((event) => {
        if (event.type === 'event') {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'node_status') {
              const { nodeId, status, output, error } = data.data
              setNodeStates(prev => ({
                ...prev,
                [nodeId]: { nodeId, status, output, error },
              }))
            } else if (data.type === 'done') {
              setWorkflowResult(data.data?.finalContext || data.data)
              setWfStatus('success')
            } else if (data.type === 'error') {
              setWfStatus('failed')
              message.error(data.data?.message || data.message || '工作流执行失败')
            }
          } catch (e) {
            console.error('SSE parse error', e)
          }
        }
      })

      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(decoder.decode(value))
      }

      // If status wasn't set by events, mark as success
      setWfStatus(prev => prev === 'running' ? 'success' : prev)
    } catch {
      message.error('工作流执行失败')
      setWfStatus('failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearWorkflow = () => {
    setWorkflowResult(null)
    setNodeStates({})
    setWfStatus('idle')
  }

  const nodeStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <LoadingOutlined spin style={{ color: 'var(--c-blue)' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: 'var(--c-green)' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: '#dc2626' }} />
      case 'skipped':
        return <MinusCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
      default:
        return <LoadingOutlined style={{ color: 'var(--c-text-tertiary)' }} />
    }
  }

  const nodeStatusLabel = (status: string) => {
    switch (status) {
      case 'running': return '执行中'
      case 'success': return '成功'
      case 'failed': return '失败'
      case 'skipped': return '已跳过'
      default: return status
    }
  }

  const nodeExecList = Object.values(nodeStates)

  return (
    <div className="debug-page">
      {/* 页面头部 */}
      <div className="debug-page-header">
        <div>
          <h2 className="debug-page-title">调试中心</h2>
          <p className="debug-page-desc">验证 AI 对话、工作流执行和知识库检索效果。</p>
        </div>
        <div className="debug-header-stats">
          <div className="debug-stat">
            <span className="debug-stat-label">消息数</span>
            <span className="debug-stat-value">{messages.length}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">可用应用</span>
            <span className="debug-stat-value">{Array.isArray(apps) ? apps.length : 0}</span>
          </div>
        </div>
      </div>

      {/* 标签栏 */}
      <div className="debug-tab-bar">
        <button
          className={`debug-tab ${activeTab === 'chat' ? 'debug-tab--active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageOutlined />
          AI 对话
        </button>
        <button
          className={`debug-tab ${activeTab === 'workflow' ? 'debug-tab--active' : ''}`}
          onClick={() => setActiveTab('workflow')}
        >
          <NodeIndexOutlined />
          工作流执行
        </button>
      </div>

      {/* ===== 对话面板 ===== */}
      {activeTab === 'chat' && (
        <div className="debug-chat-card">
          {/* 消息列表 */}
          <div className="debug-messages">
            {messages.length === 0 && !streamingContent ? (
              <div className="debug-empty">
                <RobotOutlined className="debug-empty-icon" />
                <Text strong style={{ color: 'var(--c-text-primary)' }}>发送消息开始调试</Text>
                <Text style={{ color: 'var(--c-text-secondary)', fontSize: 13 }}>
                  验证 AI 回复和知识库检索效果
                </Text>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className={`chat-msg chat-msg--${msg.role}`}>
                    <div className={`chat-avatar chat-avatar--${msg.role}`}>
                      {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    </div>
                    <div className="chat-body">
                      <div className="chat-meta">
                        <span className="chat-name">{msg.role === 'user' ? '我' : 'AI 助手'}</span>
                        <span className="chat-time">
                          {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`chat-bubble chat-bubble--${msg.role}`}>
                        {msg.role === 'assistant' ? (
                          <div className="chat-markdown">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <Paragraph style={{ margin: 0 }}>{msg.content}</Paragraph>
                        )}

                        {msg.references && msg.references.length > 0 && (
                          <div className="chat-refs">
                            <div className="chat-refs-label">
                              <FileSearchOutlined />
                              引用了 {msg.references.length} 份文档
                            </div>
                            {msg.references.map((ref, idx) => (
                              <div key={idx} className="chat-ref-item">
                                <div className="chat-ref-head">
                                  <Text strong style={{ fontSize: 12 }}>{ref.documentName}</Text>
                                  <span className="chat-ref-score">
                                    {Math.round(ref.similarity * 100)}% 相似
                                  </span>
                                </div>
                                <Paragraph
                                  ellipsis={{ rows: 2 }}
                                  style={{ margin: 0, fontSize: 12, color: 'var(--c-text-secondary)' }}
                                >
                                  {ref.content}
                                </Paragraph>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isStreaming && (
                  <div className="chat-msg chat-msg--assistant">
                    <div className="chat-avatar chat-avatar--assistant chat-avatar--streaming">
                      <RobotOutlined />
                    </div>
                    <div className="chat-body">
                      <div className="chat-meta">
                        <span className="chat-name">AI 助手</span>
                        <span className="chat-streaming-label">生成中…</span>
                      </div>
                      <div className="chat-bubble chat-bubble--assistant">
                        <div className="chat-markdown">
                          <ReactMarkdown>{streamingContent || '…'}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* 输入区域 */}
          <div className="debug-input-area">
            <Select
              placeholder="关联知识库（可选）"
              allowClear
              value={selectedKbId || undefined}
              onChange={setSelectedKbId}
              style={{ width: 200 }}
              size="small"
            >
              {Array.isArray(knowledgeBases) && knowledgeBases.map(kb => (
                <Option key={kb.id} value={kb.id}>{kb.name}</Option>
              ))}
            </Select>
            <div className="debug-input-row">
              <Input.TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="输入消息，Shift+Enter 换行，Enter 发送"
                autoSize={{ minRows: 2, maxRows: 5 }}
                className="debug-textarea"
                onCompositionStart={() => { isComposingRef.current = true }}
                onCompositionEnd={() => { isComposingRef.current = false }}
                onKeyDown={(e) => {
                  // 输入法组合中按回车是选字，不发送
                  if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                loading={isStreaming}
                disabled={!input.trim()}
                className="debug-send-btn"
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 工作流面板 ===== */}
      {activeTab === 'workflow' && (
        <div className="debug-workflow-card">
          {/* 控制栏 */}
          <div className="debug-wf-controls">
            <Select
              placeholder={<span style={{ color: 'var(--c-text-primary)', fontWeight: 500 }}>选择应用</span>}
              onChange={handleAppChange}
              value={selectedAppId || undefined}
              style={{ width: 220 }}
            >
              {apps.map(app => (
                <Option key={app.id} value={app.id}>{app.name}</Option>
              ))}
            </Select>
            <Select
              placeholder={<span style={{ color: selectedAppId ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', fontWeight: selectedAppId ? 500 : 400 }}>选择工作流</span>}
              onChange={handleWorkflowChange}
              value={selectedWorkflowId || undefined}
              disabled={!selectedAppId}
              style={{ width: 220 }}
            >
              {workflows.map(wf => (
                <Option key={wf.id} value={wf.id}>{wf.name}</Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRunWorkflow}
              loading={isLoading}
              disabled={!selectedWorkflowId}
              style={{ background: 'var(--c-green)', borderColor: 'var(--c-green)' }}
            >
              执行工作流
            </Button>
            {(nodeExecList.length > 0 || workflowResult) && !isLoading && (
              <Button
                icon={<ClearOutlined />}
                onClick={handleClearWorkflow}
              >
                清除
              </Button>
            )}
          </div>

          {/* 工作流输入参数 */}
          <div className="debug-wf-inputs">
            {requiredInputFields.length > 0 ? (
              /* 有输入字段：逐字段输入 */
              <>
                <label className="debug-wf-inputs-label">输入参数</label>
                <div className="debug-wf-field-list">
                  {requiredInputFields.map(field => (
                    <div key={field} className="debug-wf-field-row">
                      <span className="debug-wf-field-label">{field}</span>
                      <Input
                        value={fieldInputs[field] || ''}
                        onChange={(e) => setFieldInputs(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`请输入 ${field}`}
                        disabled={isLoading}
                        className="debug-wf-field-input"
                        onPressEnter={handleRunWorkflow}
                      />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* 无 UserInput 节点：简单文本输入，自动包装为 { input: '...' } */
              <>
                <label className="debug-wf-inputs-label">输入内容</label>
                <Input.TextArea
                  value={simpleInput}
                  onChange={(e) => setSimpleInput(e.target.value)}
                  placeholder="请输入内容，如：你好，帮我介绍一下...&#10;（内容将自动以 { input: '…' } 格式传入工作流）"
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  className="debug-wf-inputs-textarea"
                  disabled={isLoading}
                />
              </>
            )}
          </div>

          {/* 执行状态 */}
          {wfStatus !== 'idle' && (
            <div className={`debug-wf-status debug-wf-status--${wfStatus}`}>
              {wfStatus === 'running' && <LoadingOutlined spin />}
              {wfStatus === 'success' && <CheckCircleOutlined />}
              {wfStatus === 'failed' && <CloseCircleOutlined />}
              <span>
                {wfStatus === 'running' ? '执行中…' : wfStatus === 'success' ? '执行完成' : '执行失败'}
              </span>
            </div>
          )}

          {/* 节点执行状态卡片 */}
          {nodeExecList.length > 0 && (
            <div className="debug-wf-nodes">
              <Divider orientation="left" style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                节点执行详情 ({nodeExecList.length} 个节点)
              </Divider>
              <div className="debug-wf-node-list">
                {nodeExecList.map((ns) => (
                  <div key={ns.nodeId} className={`debug-wf-node-card debug-wf-node-card--${ns.status}`}>
                    <div className="debug-wf-node-header">
                      {nodeStatusIcon(ns.status)}
                      <span className="debug-wf-node-id">{ns.nodeId}</span>
                      <span className={`debug-wf-node-badge debug-wf-node-badge--${ns.status}`}>
                        {nodeStatusLabel(ns.status)}
                      </span>
                    </div>
                    {ns.output && (
                      <div
                        className="debug-wf-node-output"
                        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                      >
                        {formatNodeOutput(ns.output)}
                      </div>
                    )}
                    {ns.error && (
                      <div className="debug-wf-node-error">{ns.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最终结果 */}
          {workflowResult && (
            <div className="debug-wf-result">
              <Divider orientation="left" style={{ fontSize: 12, color: 'var(--c-text-secondary)' }}>
                最终输出
              </Divider>
              <div
                className="debug-wf-pre"
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                }}
              >
                {extractFinalOutput(workflowResult)}
              </div>
            </div>
          )}

          {/* 空状态 */}
          {wfStatus === 'idle' && nodeExecList.length === 0 && !workflowResult && (
            <div className="debug-wf-empty">
              <Empty
                image={<PlayCircleOutlined style={{ fontSize: 36, color: 'var(--c-green)', opacity: 0.4 }} />}
                description={
                  <span style={{ color: 'var(--c-text-secondary)', fontSize: 13 }}>
                    选择应用和工作流后点击执行，实时查看每个节点的执行状态
                  </span>
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Debug

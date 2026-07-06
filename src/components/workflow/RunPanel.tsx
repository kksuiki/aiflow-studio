import { useState, useMemo } from 'react'
import { Button, Input, Empty, Tag, Tooltip } from 'antd'
import {
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  MinusCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useStore } from '../../store'
import { NodeErrorInfo, ErrorSeverity } from '../../types'
import './RunPanel.css'

const { TextArea } = Input

/** 将节点 output 格式化为可读文本 */
function formatNodeOutput(output: any): string {
  if (output == null) return ''
  if (typeof output === 'string') return output
  if (typeof output.result === 'string') return output.result
  if (output.result != null && typeof output.result === 'object') {
    return JSON.stringify(output.result, null, 2)
  }
  return JSON.stringify(output, null, 2)
}

const RunPanel: React.FC = () => {
  const {
    currentWorkflow,
    nodes,
    executionStates,
    executionStatus,
    streamRunWorkflow,
    setExecutionStatus,
    clearExecutionStates,
  } = useStore()

  const [inputsText, setInputsText] = useState('{"question": "你好，请介绍一下自己"}')
  const [isRunning, setIsRunning] = useState(false)
  // 逐字段输入状态
  const [fieldInputs, setFieldInputs] = useState<Record<string, string>>({})
  // 无 userInput 节点时的简单输入
  const [simpleInput, setSimpleInput] = useState('')

  // 从当前工作流的 userInput 节点中提取输入字段
  const userInputFields = useMemo(() => {
    const fields: string[] = []
    for (const node of nodes) {
      if (node.type === 'userInput' && (node.data as any)?.inputField) {
        fields.push((node.data as any).inputField as string)
      }
    }
    return fields
  }, [nodes])

  const handleRun = async () => {
    const workflowId = currentWorkflow?.id
    if (!workflowId) return

    let inputs: Record<string, any> = {}

    // userInput 字段，支持类型自动转换（如 "true" → true）
    userInputFields.forEach(f => {
      const raw = fieldInputs[f] || ''
      if (raw === 'true') inputs[f] = true
      else if (raw === 'false') inputs[f] = false
      else if (!isNaN(Number(raw)) && raw !== '') inputs[f] = Number(raw)
      else inputs[f] = raw.trim()
    })

    // 无任何字段时的兜底
    if (Object.keys(inputs).length === 0) {
      if (simpleInput.trim()) {
        inputs = { input: simpleInput.trim() }
      } else {
        try { inputs = JSON.parse(inputsText) } catch { inputs = {} }
      }
    }

    setIsRunning(true)
    try {
      await streamRunWorkflow(workflowId, inputs)
    } catch {
      // Error handled in store
    } finally {
      setIsRunning(false)
    }
  }

  const handleStop = () => {
    setIsRunning(false)
    setExecutionStatus('stopped')
  }

  const handleClear = () => {
    clearExecutionStates()
    setExecutionStatus(null)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <LoadingOutlined spin style={{ color: 'var(--c-blue)' }} />
      case 'success':
        return <CheckCircleOutlined style={{ color: 'var(--c-green)' }} />
      case 'failed':
        return <CloseCircleOutlined style={{ color: 'var(--c-red)' }} />
      case 'skipped':
        return <MinusCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
      case 'retrying':
        return <SyncOutlined spin style={{ color: 'var(--c-orange, #fa8c16)' }} />
      case 'timeout':
        return <ClockCircleOutlined style={{ color: 'var(--c-orange, #fa8c16)' }} />
      default:
        return <ClockCircleOutlined style={{ color: 'var(--c-text-tertiary)' }} />
    }
  }

  /** 获取错误严重程度对应的 Tag 颜色 */
  const severityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'warning': return 'orange'
      case 'error': return 'red'
      case 'fatal': return 'magenta'
      default: return 'default'
    }
  }

  /** 渲染错误信息（兼容旧的字符串格式和新的结构化格式） */
  const renderError = (error: string | NodeErrorInfo) => {
    if (typeof error === 'string') {
      return <span className="run-result-error-text">{error}</span>
    }
    // 结构化错误
    return (
      <div className="run-result-error">
        <div className="run-result-error-header">
          <Tag color={severityColor(error.severity)}>
            {error.severity === 'fatal' ? '致命' : error.severity === 'warning' ? '警告' : '错误'}
          </Tag>
          <span className="run-result-error-code">{error.errorCode}</span>
          {error.canRetry && (
            <Tooltip title="重新执行该节点">
              <Button
                type="link"
                size="small"
                icon={<ReloadOutlined />}
                danger
                style={{ padding: 0 }}
              >
                重试
              </Button>
            </Tooltip>
          )}
        </div>
        <div className="run-result-error-message">{error.message}</div>
        {error.userAction && error.userAction !== 'none' && (
          <div className="run-result-error-action">
            <WarningOutlined style={{ marginRight: 4 }} />
            建议操作：{getUserActionText(error.userAction)}
          </div>
        )}
      </div>
    )
  }

  const getUserActionText = (action: string) => {
    const map: Record<string, string> = {
      retry: '请稍后重试或点击重试按钮',
      check_config: '请检查节点配置参数是否正确',
      check_quota: '请检查 API 配额余额或切换模型',
      contact_admin: '请联系管理员处理',
    }
    return map[action] || action
  }

  const executedNodes = Object.values(executionStates)
  const hasResults = executedNodes.length > 0

  return (
    <div className="run-panel">
      <div className="run-panel-header">
        <h3>调试运行</h3>
      </div>

      <div className="run-panel-body">
        {/* Input section */}
        <div className="run-section">
          {userInputFields.length > 0 ? (
            /* 有 userInput 节点：逐字段输入 */
            <>
              <label className="run-section-label">输入参数</label>
              <div className="run-field-list">
                {userInputFields.map(field => (
                  <div key={field} className="run-field-row">
                    <span className="run-field-label">{field}</span>
                    <Input
                      value={fieldInputs[field] || ''}
                      onChange={e => setFieldInputs(prev => ({ ...prev, [field]: e.target.value }))}
                      placeholder={`请输入 ${field}`}
                      disabled={isRunning}
                      onPressEnter={handleRun}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* 无 userInput 节点：简单文本输入，自动包装 */
            <>
              <label className="run-section-label">输入内容</label>
              <Input.TextArea
                value={simpleInput}
                onChange={e => setSimpleInput(e.target.value)}
                placeholder="请输入内容，如：你好，帮我..."
                rows={3}
                className="run-input-textarea"
                disabled={isRunning}
              />
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="run-actions">
          {isRunning ? (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              block
              size="middle"
            >
              停止
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleRun}
              block
              size="middle"
            >
              运行工作流
            </Button>
          )}
          {hasResults && !isRunning && (
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="middle"
              className="run-clear-btn"
            >
              清除
            </Button>
          )}
        </div>

        {/* Execution status */}
        {executionStatus && (
          <div className={`run-status run-status--${executionStatus}`}>
            {statusIcon(executionStatus)}
            <span>
              {executionStatus === 'running'
                ? '运行中…'
                : executionStatus === 'success'
                ? '执行完成'
                : executionStatus === 'failed'
                ? '执行失败'
                : '已停止'}
            </span>
          </div>
        )}

        {/* Node results */}
        {hasResults ? (
          <div className="run-results">
            <label className="run-section-label">节点执行结果</label>
            {executedNodes.map((exec) => {
              const node = nodes.find((n) => n.id === exec.nodeId)
              return (
                <div key={exec.nodeId} className="run-result-card">
                  <div className="run-result-header">
                    {statusIcon(exec.status)}
                    <span className="run-result-name">
                      {(node?.data as any)?.label || exec.nodeId}
                    </span>
                    <span className="run-result-type">{node?.type}</span>
                  </div>
                  {(exec as any).output && (
                    <div
                      className="run-result-output"
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {formatNodeOutput((exec as any).output)}
                    </div>
                  )}
                  {exec.error && renderError(exec.error)}
                </div>
              )
            })}
          </div>
        ) : (
          !isRunning && (
            <div className="run-empty">
              <Empty
                description="点击「运行工作流」开始调试"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default RunPanel

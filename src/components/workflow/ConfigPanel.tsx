import { useEffect, useState, useCallback, useMemo } from 'react'
import { useStore } from '../../store'
import { Form, Input, InputNumber, Select, Slider, Typography, Empty, Button, Space, Modal, Divider, message } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import VariableSelector from './VariableSelector'
import { getUpstreamVariables } from '../../utils/upstream-variables'
import './ConfigPanel.css'

const { Text } = Typography
const { Option } = Select

/** KV 参数编辑器：替代 Skill 节点的 JSON 文本框 */
const KVEditor: React.FC<{ value?: Record<string, string>; onChange?: (v: Record<string, string>) => void }> = ({
  value = {},
  onChange,
}) => {
  // 内部维护有序的 [key, value] 列表
  const [pairs, setPairs] = useState<[string, string][]>(() => Object.entries(value))

  // 同步外部 value 变化（切换节点时）
  useEffect(() => {
    setPairs(Object.entries(value || {}))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)])

  const notify = useCallback((newPairs: [string, string][]) => {
    const obj: Record<string, string> = {}
    newPairs.forEach(([k, v]) => { if (k.trim()) obj[k.trim()] = v })
    onChange?.(obj)
  }, [onChange])

  const addRow = () => {
    const newPairs: [string, string][] = [...pairs, ['', '']]
    setPairs(newPairs)
    notify(newPairs)
  }

  const removeRow = (idx: number) => {
    const newPairs = pairs.filter((_, i) => i !== idx)
    setPairs(newPairs)
    notify(newPairs)
  }

  const updateRow = (idx: number, field: 0 | 1, val: string) => {
    const newPairs = pairs.map((p, i) => i === idx ? (field === 0 ? [val, p[1]] : [p[0], val]) as [string, string] : p)
    setPairs(newPairs)
    notify(newPairs)
  }

  return (
    <div className="kv-editor">
      {pairs.map(([k, v], idx) => (
        <Space key={idx} className="kv-editor-row" align="center">
          <Input
            value={k}
            onChange={e => updateRow(idx, 0, e.target.value)}
            placeholder="参数名"
            className="kv-input-key"
          />
          <Input
            value={v}
            onChange={e => updateRow(idx, 1, e.target.value)}
            placeholder="参数値"
            className="kv-input-val"
          />
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => removeRow(idx)}
          />
        </Space>
      ))}
      <Button
        type="dashed"
        size="small"
        icon={<PlusOutlined />}
        onClick={addRow}
        block
        className="kv-add-btn"
      >
        添加参数
      </Button>
    </div>
  )
}

const ConfigPanel: React.FC = () => {
  const { selectedNode, updateNodeData, knowledgeBases, fetchKnowledgeBases, skills, fetchSkills, createKnowledgeBase, nodes: allNodes, edges: allEdges } = useStore()
  const [form] = Form.useForm()
  const promptTemplateMode = Form.useWatch('promptTemplate', form)

  // ===== condition 节点可用变量（顶层 Hook，避免违反 Rules of Hooks）=====
  const conditionAvailableVars = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'condition') return []
    const vars: { reference: string; display: string }[] = []
    const seen = new Set<string>()

    // 1. userInput 节点的 inputField（直接上下文变量，如 buildRag）
    for (const node of allNodes) {
      if (node.type === 'userInput' && (node.data as any)?.inputField) {
        const fieldName = (node.data as any).inputField as string
        if (!seen.has(fieldName)) {
          vars.push({
            reference: fieldName,
            display: `${(node.data as any).label || fieldName}（${fieldName}）`,
          })
          seen.add(fieldName)
        }
      }
    }

    // 2. 上游节点的输出字段（如 llm_2.result）
    const upstream = getUpstreamVariables(selectedNode.id, allNodes as any, allEdges as any)
    for (const v of upstream) {
      if (!seen.has(v.reference)) {
        vars.push({ reference: v.reference, display: v.display })
        seen.add(v.reference)
      }
    }

    return vars
  }, [selectedNode, allNodes, allEdges])

  // ===== 新建知识库内联状态 =====
  const [kbModalOpen, setKbModalOpen] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  const [newKbDesc, setNewKbDesc] = useState('')
  const [kbCreating, setKbCreating] = useState(false)

  const handleCreateKbInline = async () => {
    if (!newKbName.trim()) return
    setKbCreating(true)
    try {
      const kb = await createKnowledgeBase({ name: newKbName.trim(), description: newKbDesc.trim() || undefined })
      // 自动选中新建的知识库
      if (selectedNode) {
        form.setFieldsValue({ knowledgeBaseId: kb.id })
        handleValuesChange({ knowledgeBaseId: kb.id }, { ...form.getFieldsValue(), knowledgeBaseId: kb.id })
      }
      message.success(`知识库「${kb.name}」创建成功`)
      setKbModalOpen(false)
      setNewKbName('')
      setNewKbDesc('')
    } catch {
      message.error('知识库创建失败，请重试')
    } finally {
      setKbCreating(false)
    }
  }

  // 加载知识库和工具列表
  useEffect(() => {
    fetchKnowledgeBases()
    fetchSkills()
  }, [fetchKnowledgeBases, fetchSkills])

  useEffect(() => {
    if (selectedNode) {
      form.setFieldsValue(selectedNode.data)
    } else {
      form.resetFields()
    }
  }, [selectedNode, form])

  const handleValuesChange = (_changedValues: any, allValues: any) => {
    if (selectedNode) {
      updateNodeData(selectedNode.id, allValues)
    }
  }

  const renderConfigForm = () => {
    if (!selectedNode) {
      return <Empty description="选择节点以编辑配置" className="config-panel-empty" />
    }

    const commonFields = (
      <Form.Item name="label" label="节点名称">
        <Input placeholder="输入节点名称" />
      </Form.Item>
    )

    switch (selectedNode.type) {
      case 'start':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              开始节点是工作流的拓扑起点，不承载任何输入或输出。
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              若需接收用户输入，请在开始节点后添加「用户输入」节点。
            </Text>
          </div>
        )
      case 'userInput':
        return (
          <>
            {commonFields}
            <Form.Item name="inputField" label="输入字段" rules={[{ required: true }]}>
              <Input placeholder="例如: question" />
            </Form.Item>
          </>
        )
      case 'llm':
        return (
          <>
            {commonFields}
            <Form.Item name="model" label="模型" initialValue="deepseek-chat">
              <Select>
                <Option value="deepseek-chat">DeepSeek Chat (V3)</Option>
                <Option value="deepseek-reasoner">DeepSeek Reasoner (R1)</Option>
              </Select>
            </Form.Item>
            <Form.Item name="promptTemplate" label="模板模式" initialValue="auto">
              <Select>
                <Option value="auto">自动（根据上游节点自动构建）</Option>
                <Option value="custom">自定义（手动编写任务指令）</Option>
              </Select>
            </Form.Item>
            <Form.Item name="systemPrompt" label="系统提示词">
              <Input.TextArea rows={4} placeholder="定义模型的角色和行为" />
            </Form.Item>
            {promptTemplateMode === 'custom' ? (
              <>
                <Form.Item name="userPrompt" label="任务指令" rules={[{ required: true }]}>
                  <Input.TextArea
                    rows={8}
                    placeholder={`定义本次模型调用的具体任务。\n\n示例（RAG 问答场景）：\n用户问题：{{userInput_xxx.result}}\n\n参考资料：\n{{rag_xxx.result}}\n\n请根据参考资料回答用户问题。如果参考资料中没有相关内容，请如实告知用户。`}
                  />
                </Form.Item>
              </>
            ) : (
              <Form.Item>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  自动模式：后端会检测上游的用户输入和 RAG 检索节点，自动构建结构化的提示词。
                  如有 RAG 内容，会自动分隔为“用户问题”和“参考资料”两部分。
                </Text>
              </Form.Item>
            )}
            <Form.Item name="temperature" label="温度" initialValue={0.7}>
              <Slider min={0} max={1} step={0.1} />
            </Form.Item>
            <Form.Item name="maxTokens" label="最大 Token">
              <InputNumber min={100} max={16384} step={100} style={{ width: '100%' }} placeholder="留空则由模型自行控制输出长度" />
            </Form.Item>
            <Form.Item label="插入变量">
              <VariableSelector
                nodeId={selectedNode.id}
                currentValue={form.getFieldValue('userPrompt') || ''}
                onInsert={(tpl) => {
                  const cur = form.getFieldValue('userPrompt') || ''
                  const newVal = cur ? cur + '\n' + tpl : tpl
                  form.setFieldsValue({ userPrompt: newVal })
                  handleValuesChange({ userPrompt: newVal }, { ...form.getFieldsValue(), userPrompt: newVal })
                }}
              />
            </Form.Item>
          </>
        )
      case 'rag':
        return (
          <>
            {commonFields}
            <Form.Item name="knowledgeBaseId" label="知识库" rules={[{ required: true }]}>
              <Select placeholder="选择一个知识库">
                {Array.isArray(knowledgeBases) && knowledgeBases.map(kb => (
                  <Option key={kb.id} value={kb.id}>{kb.name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="query" label="检索查询" rules={[{ required: true }]}>
              <Input.TextArea placeholder="输入检索内容，可使用 {{变量}}" />
            </Form.Item>
            <Form.Item name="topK" label="Top K" initialValue={5}>
              <Slider min={1} max={10} step={1} />
            </Form.Item>
            <Form.Item label="插入变量">
              <VariableSelector
                nodeId={selectedNode.id}
                currentValue={form.getFieldValue('query') || ''}
                onInsert={(tpl) => {
                  const newVal = (form.getFieldValue('query') || '') + (form.getFieldValue('query') ? '\n' : '') + tpl
                  form.setFieldsValue({ query: newVal })
                  handleValuesChange({ query: newVal }, { ...form.getFieldsValue(), query: newVal })
                }}
              />
            </Form.Item>
          </>
        )
      case 'skill':
        return (
          <>
            {commonFields}
            <Form.Item name="skillId" label="选择工具" rules={[{ required: true }]}>
              <Select placeholder="选择一个内置或自定义工具">
                {Array.isArray(skills) && skills.map(s => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="工具参数" name="parameters">
              <KVEditor />
            </Form.Item>
          </>
        )
      case 'condition': {
        const conditionList: Array<{ variable: string; operator: string; value: any }> =
          Array.isArray(form.getFieldValue('conditions')) ? form.getFieldValue('conditions') : []

        const updateConditionList = (newList: typeof conditionList) => {
          form.setFieldsValue({ conditions: newList })
          handleValuesChange({ conditions: newList }, { ...form.getFieldsValue(), conditions: newList })
        }

        const updateCondRow = (idx: number, field: 'variable' | 'operator' | 'value', val: any) => {
          const newList = [...conditionList]
          newList[idx] = { ...newList[idx], [field]: val }
          updateConditionList(newList)
        }

        const addCondRow = () => {
          updateConditionList([...conditionList, { variable: '', operator: '===', value: '' }])
        }

        const removeCondRow = (idx: number) => {
          updateConditionList(conditionList.filter((_, i) => i !== idx))
        }

        return (
          <>
            {commonFields}
            <Text type="secondary" style={{ fontSize: 12 }}>
              配置分支判断逻辑。条件为真时从上方 <span style={{ color: '#16a34a', fontWeight: 600 }}>True</span> 输出，否则从下方 <span style={{ color: '#dc2626', fontWeight: 600 }}>False</span> 输出。
            </Text>
            <div style={{ marginTop: 12 }}>
              {conditionList.map((cond, idx) => (
                <div key={idx} style={{
                  padding: '10px 12px', marginBottom: 8,
                  border: '1px solid var(--c-border)', borderRadius: 8,
                  background: 'var(--c-bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-secondary)' }}>条件 {idx + 1}</Text>
                    {conditionList.length > 1 && (
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeCondRow(idx)} />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Select
                      size="small"
                      value={cond.variable ? cond.variable.replace(/\{\{|\}\}/g, '') : undefined}
                      onChange={(val: string) => updateCondRow(idx, 'variable', `{{${val}}}`)}
                      placeholder="选择要判断的变量"
                      style={{ width: '100%' }}
                      showSearch
                      allowClear
                      onClear={() => updateCondRow(idx, 'variable', '')}
                    >
                      {conditionAvailableVars.map(v => (
                        <Option key={v.reference} value={v.reference}>{v.display}</Option>
                      ))}
                    </Select>
                    <Select
                      size="small"
                      value={cond.operator || '==='}
                      onChange={val => updateCondRow(idx, 'operator', val)}
                      style={{ width: '100%' }}
                    >
                      <Option value="===">等于 (===)</Option>
                      <Option value="!==">不等于 (!==)</Option>
                      <Option value=">">{'大于 (>)'}</Option>
                      <Option value="<">{'小于 (<)'}</Option>
                      <Option value=">=">{'大于等于 (>=)'}</Option>
                      <Option value="<=">{'小于等于 (<=)'}</Option>
                      <Option value="contains">包含 (contains)</Option>
                    </Select>
                    <Input
                      size="small"
                      value={cond.value !== undefined ? String(cond.value) : ''}
                      onChange={e => {
                        let v: any = e.target.value
                        if (v === 'true') v = true
                        else if (v === 'false') v = false
                        else if (!isNaN(Number(v)) && v !== '') v = Number(v)
                        updateCondRow(idx, 'value', v)
                      }}
                      placeholder="比较值，如 true、7、关键词"
                    />
                  </div>
                </div>
              ))}
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addCondRow} block>
                添加条件
              </Button>
            </div>
          </>
        )
      }
      case 'output':
        return (
          <>
            {commonFields}
            <Form.Item name="outputValue" label="输出内容" rules={[{ required: true }]}>
              <Input.TextArea rows={4} placeholder="最终输出给用户的内容，支持 {{变量}}" />
            </Form.Item>
            <Form.Item label="插入变量">
              <VariableSelector
                nodeId={selectedNode.id}
                currentValue={form.getFieldValue('outputValue') || ''}
                onInsert={(tpl) => {
                  const newVal = (form.getFieldValue('outputValue') || '') + (form.getFieldValue('outputValue') ? '\n' : '') + tpl
                  form.setFieldsValue({ outputValue: newVal })
                  handleValuesChange({ outputValue: newVal }, { ...form.getFieldsValue(), outputValue: newVal })
                }}
              />
            </Form.Item>
          </>
        )
      case 'writeRag':
        return (
          <>
            {commonFields}
            <Form.Item name="knowledgeBaseId" label="目标知识库" rules={[{ required: true }]}>
              <Select
                placeholder="选择要写入的知识库"
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ padding: '4px 8px' }}>
                      <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={() => setKbModalOpen(true)}
                        block
                        style={{ textAlign: 'left' }}
                      >
                        新建知识库
                      </Button>
                    </div>
                  </>
                )}
              >
                {Array.isArray(knowledgeBases) && knowledgeBases.map(kb => (
                  <Option key={kb.id} value={kb.id}>{kb.name}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="content" label="生成主题 / 原始内容" rules={[{ required: true }]}>
              <Input.TextArea rows={4} placeholder="输入主题或原始内容，节点会调用大模型生成结构化知识库文档。可使用 {{变量}} 引用上游节点输出。" />
            </Form.Item>
            <Form.Item name="systemPrompt" label="系统提示词">
              <Input.TextArea rows={4} placeholder="留空使用默认提示词：根据主题生成结构化知识库文档" />
            </Form.Item>
            <Form.Item name="model" label="模型">
              <Input placeholder="留空使用环境变量中的默认模型" />
            </Form.Item>
            <Form.Item name="temperature" label="温度">
              <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} placeholder="默认 0.7" />
            </Form.Item>
            <Form.Item name="maxTokens" label="最大 Token">
              <InputNumber min={100} max={16384} step={100} style={{ width: '100%' }} placeholder="留空则由模型自行控制输出长度" />
            </Form.Item>
            <Form.Item label="插入变量">
              <VariableSelector
                nodeId={selectedNode.id}
                currentValue={form.getFieldValue('content') || ''}
                onInsert={(tpl) => {
                  const newVal = (form.getFieldValue('content') || '') + (form.getFieldValue('content') ? '\n' : '') + tpl
                  form.setFieldsValue({ content: newVal })
                  handleValuesChange({ content: newVal }, { ...form.getFieldsValue(), content: newVal })
                }}
              />
            </Form.Item>
          </>
        )
      default:
        return <Empty description={`暂不支持 ${selectedNode.type} 节点的配置`} />
    }
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h3>{selectedNode ? '节点配置' : '配置'}</h3>
      </div>
      <div className="config-panel-body">
        <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
          {renderConfigForm()}
        </Form>
      </div>

      {/* 内联新建知识库弹窗 */}
      <Modal
        title="新建知识库"
        open={kbModalOpen}
        onOk={handleCreateKbInline}
        onCancel={() => { setKbModalOpen(false); setNewKbName(''); setNewKbDesc('') }}
        confirmLoading={kbCreating}
        okText="创建"
        cancelText="取消"
        width={400}
        okButtonProps={{ disabled: !newKbName.trim(), style: { background: 'var(--c-accent)', borderColor: 'var(--c-accent)' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>知识库名称 <span style={{ color: '#ff4d4f' }}>*</span></div>
            <Input
              placeholder="给知识库起个名字"
              value={newKbName}
              onChange={e => setNewKbName(e.target.value)}
              onPressEnter={handleCreateKbInline}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>描述（可选）</div>
            <Input.TextArea
              placeholder="这个知识库的用途"
              value={newKbDesc}
              onChange={e => setNewKbDesc(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ConfigPanel

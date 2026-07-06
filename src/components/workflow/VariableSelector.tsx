import { useMemo } from 'react'
import { Select, Tag } from 'antd'
import { useStore } from '../../store'
import { getUpstreamVariables, type UpstreamVariable } from '../../utils/upstream-variables'

const { Option } = Select

interface VariableSelectorProps {
  /** 当前选中的节点 ID */
  nodeId: string
  /** 目标文本框的当前值，用于检测已插入的变量 */
  currentValue: string
  /** 插入变量后的回调：传入模板字符串 */
  onInsert: (template: string) => void
}

/** 从文本中提取所有已引用的变量 reference */
function extractInsertedRefs(text: string): Set<string> {
  if (!text) return new Set()
  const matches = text.matchAll(/\{\{(.+?)\}\}/g)
  return new Set(Array.from(matches, m => m[1].trim()))
}

/**
 * 变量选择器：
 * - 上方显示已引用的变量（Tag 标签）
 * - 下方下拉菜单插入新变量
 */
const VariableSelector: React.FC<VariableSelectorProps> = ({ nodeId, currentValue, onInsert }) => {
  const { nodes, edges } = useStore()

  const allVariables = useMemo(
    () => getUpstreamVariables(nodeId, nodes as any, edges as any),
    [nodeId, nodes, edges]
  )

  const insertedRefs = useMemo(() => extractInsertedRefs(currentValue), [currentValue])

  // 已插入的变量（匹配到的变量对象）
  const insertedVariables = useMemo(
    () => allVariables.filter(v => insertedRefs.has(v.reference)),
    [allVariables, insertedRefs]
  )

  // 未插入的变量
  const availableVariables = useMemo(
    () => allVariables.filter(v => !insertedRefs.has(v.reference)),
    [allVariables, insertedRefs]
  )

  if (allVariables.length === 0) {
    return (
      <Select disabled placeholder="无上游节点可引用" style={{ width: '100%' }} />
    )
  }

  return (
    <div>
      {/* 已引用变量标签 */}
      {insertedVariables.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#888', marginRight: 4 }}>已引用：</span>
          {insertedVariables.map(v => (
            <Tag key={v.reference} color="blue" style={{ marginBottom: 4 }}>
              {v.display}
            </Tag>
          ))}
        </div>
      )}

      {/* 下拉菜单：插入新变量 */}
      {availableVariables.length > 0 ? (
        <Select
          placeholder="选择一个变量插入到上方文本框"
          style={{ width: '100%' }}
          onChange={(value: string) => {
            onInsert(`{{${value}}}`)
          }}
          value={undefined}
        >
          {availableVariables.map((v: UpstreamVariable) => (
            <Option key={v.reference} value={v.reference}>
              {v.display}
            </Option>
          ))}
        </Select>
      ) : (
        <Select disabled placeholder="所有上游变量均已插入" style={{ width: '100%' }} />
      )}
    </div>
  )
}

export default VariableSelector

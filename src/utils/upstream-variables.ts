/**
 * 上游变量工具
 * 
 * 用于计算某个节点的所有前驱节点及其可用输出字段
 */

import type { Node, Edge } from '@xyflow/react'

// 节点类型 -> 输出字段映射
const NODE_OUTPUT_FIELDS: Record<string, string[]> = {
  userInput: ['result'],
  llm: ['result'],
  rag: ['result', 'documents'],
  skill: ['result'],
  condition: ['result'],
  output: ['result'],
  writeRag: ['result', 'documents', 'generatedContent'],
}

export interface UpstreamVariable {
  nodeId: string
  nodeName: string
  field: string
  reference: string // 完整的引用路径，如 "llm_1234567890.result"
  display: string   // 友好显示名，如 "大模型.result"
}

/**
 * 获取指定节点的所有可用上游变量
 * 
 * @param nodeId - 当前节点 ID
 * @param nodes - 所有节点
 * @param edges - 所有边
 * @returns 可用变量列表
 */
export function getUpstreamVariables(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): UpstreamVariable[] {
  // 1. 构建反向邻接表：target -> [source1, source2, ...]
  const reverseAdj = new Map<string, string[]>()
  for (const edge of edges) {
    if (!reverseAdj.has(edge.target)) {
      reverseAdj.set(edge.target, [])
    }
    reverseAdj.get(edge.target)!.push(edge.source)
  }

  // 2. BFS 反向遍历，收集所有前驱节点
  const visited = new Set<string>()
  const queue = [nodeId]
  const upstreamNodeIds: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    const predecessors = reverseAdj.get(current) || []

    for (const predId of predecessors) {
      if (!visited.has(predId)) {
        visited.add(predId)
        queue.push(predId)
        upstreamNodeIds.push(predId)
      }
    }
  }

  // 3. 收集每个前驱节点的输出字段
  const variables: UpstreamVariable[] = []

  for (const predId of upstreamNodeIds) {
    const node = nodes.find(n => n.id === predId)
    if (!node || node.type === 'start') continue // 排除 start 节点

    const fields = NODE_OUTPUT_FIELDS[node.type as string] || ['result']
    const nodeData = node.data as any
    const nodeName = nodeData?.label || node.type || '未知节点'

    for (const field of fields) {
      variables.push({
        nodeId: node.id,
        nodeName,
        field,
        reference: `${node.id}.${field}`,
        display: `${nodeName}.${field}`,
      })
    }

    // userInput 节点额外展示用户声明的变量名（如 topic、buildRag）
    if (node.type === 'userInput' && nodeData?.inputField) {
      const inputField = nodeData.inputField as string
      variables.push({
        nodeId: node.id,
        nodeName,
        field: inputField,
        reference: `${node.id}.${inputField}`,
        display: `${nodeName}.${inputField}（用户输入变量）`,
      })
    }
  }

  return variables
}

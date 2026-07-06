import { useCallback, useEffect, useRef } from 'react'
import { ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../../store'
import StartNode from './nodes/StartNode'
import UserInputNode from './nodes/UserInputNode'
import LLMNode from './nodes/LLMNode'
import RAGNode from './nodes/RAGNode'
import SkillNode from './nodes/SkillNode'
import ConditionNode from './nodes/ConditionNode'
import OutputNode from './nodes/OutputNode'
import WriteRagNode from './nodes/WriteRagNode'
import { NodeType, WorkflowNode } from '../../types'
import DeletableEdge from './edges/DeletableEdge'
import './WorkflowCanvas.css'

// 自定义边类型
const edgeTypes = {
  default: DeletableEdge,
}

// 自定义节点类型
const nodeTypes = {
  start: StartNode,
  userInput: UserInputNode,
  llm: LLMNode,
  rag: RAGNode,
  skill: SkillNode,
  condition: ConditionNode,
  output: OutputNode,
  writeRag: WriteRagNode,
}

const createNodeData = (type: NodeType): WorkflowNode['data'] => {
  switch (type) {
    case 'start':
      return { label: '开始', variables: [] }
    case 'userInput':
      return { label: '用户输入', inputField: '' }
    case 'llm':
      return {
        label: '大模型',
        model: 'deepseek-chat',
        systemPrompt: '',
        userPrompt: '',
        temperature: 0.7,
        maxTokens: 1024,
      }
    case 'rag':
      return {
        label: 'RAG检索',
        knowledgeBaseId: '',
        query: '',
        topK: 3,
        similarityThreshold: 0.7,
      }
    case 'skill':
      return {
        label: '工具',
        skillId: '',
        skillType: 'builtin',
        parameters: {},
      }
    case 'condition':
      return { label: '条件分支', conditions: [] }
    case 'output':
      return { label: '输出', outputValue: '' }
    case 'writeRag':
      return { label: '写入RAG', knowledgeBaseId: '', content: '' }
  }
}

const WorkflowCanvas: React.FC = () => {
  const { 
    nodes, 
    edges, 
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setSelectedNode, 
    executionStates,
    pushSnapshot,
    undo,
    redo,
    undoStack,
    redoStack,
  } = useStore()

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  // ---- 撤销/重做 ----
  const handleUndo = useCallback(() => {
    const snapshot = undo(nodes, edges)
    if (snapshot) {
      // 直接用 setState 恢复，绕过 setNodes/setEdges 中的快照逻辑
      useStore.setState({ nodes: snapshot.nodes, edges: snapshot.edges })
      setSelectedNode(null)
    }
  }, [undo, nodes, edges, setSelectedNode])

  const handleRedo = useCallback(() => {
    const snapshot = redo(nodes, edges)
    if (snapshot) {
      useStore.setState({ nodes: snapshot.nodes, edges: snapshot.edges })
      setSelectedNode(null)
    }
  }, [redo, nodes, edges, setSelectedNode])

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleUndo, handleRedo])

  // 拖拽节点前保存快照（拖拽过程中 onNodesChange 不再重复保存）
  const onNodeDragStart = useCallback(() => {
    pushSnapshot(nodes, edges)
  }, [pushSnapshot, nodes, edges])

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    setSelectedNode(node)
  }, [setSelectedNode])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow') as NodeType

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      
      const newNode: WorkflowNode = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: createNodeData(type),
      }

      setNodes([...nodes, newNode])
    },
    [screenToFlowPosition, nodes, setNodes]
  )

  return (
    <div className="workflow-canvas" ref={reactFlowWrapper}>
      {/* 工具栏 */}
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-left">
          <button
            className={`toolbar-btn ${!canUndo ? 'disabled' : ''}`}
            onClick={handleUndo}
            disabled={!canUndo}
            title="撤销 (Ctrl+Z)"
          >
            ↩ 撤销
          </button>
          <button
            className={`toolbar-btn ${!canRedo ? 'disabled' : ''}`}
            onClick={handleRedo}
            disabled={!canRedo}
            title="重做 (Ctrl+Shift+Z)"
          >
            ↪ 重做
          </button>
        </div>
        <div className="canvas-toolbar-right">
          <span className="toolbar-hint">Ctrl+Z 撤销 · Ctrl+Shift+Z 重做</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStart={onNodeDragStart}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        attributionPosition="top-right"
      >
        <Background color="#f0f0f0" gap={16} />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}

export default WorkflowCanvas

import { memo, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react'

const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) => {
  const [hovered, setHovered] = useState(false)
  const { setEdges } = useReactFlow()

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  })

  const showDelete = hovered || selected

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEdges((edges) => edges.filter((edge) => edge.id !== id))
  }

  return (
    <>
      {/* 透明宽路径用于扩大悬停区域 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: selected ? 2.5 : hovered ? 2 : 1.5,
          stroke: selected ? '#7c3aed' : hovered ? '#7c3aed' : '#b1b1b7',
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />
      {showDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              onClick={onDelete}
              title="删除连线"
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '1.5px solid #dc2626',
                background: '#fff',
                color: '#dc2626',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                transition: 'background 0.15s, color 0.15s',
                padding: 0,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = '#dc2626'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = '#fff'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#dc2626'
              }}
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(DeletableEdge)

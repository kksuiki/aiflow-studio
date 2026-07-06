import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

const OPERATOR_LABELS: Record<string, string> = {
  '===': '=', '!==': '≠', '>': '>', '<': '<', '>=': '≥', '<=': '≤', contains: '包含',
};

const ConditionNode = ({ id, data }: { id: string; data: any }) => {
  const conditions = Array.isArray(data?.conditions) ? data.conditions : [];

  return (
    <div style={{ position: 'relative' }}>
      <BaseNode id={id} label={data.label || '条件分支'} icon={<ApartmentOutlined />} color="#dc2626" width={250}>
        {/* 条件摘要预览 */}
        {conditions.length > 0 ? (
          <div style={{ fontSize: 11, color: '#888', lineHeight: 1.6, marginTop: 2 }}>
            {conditions.map((c: any, i: number) => (
              <div key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.variable && (
                  <span style={{ color: '#7c3aed', fontWeight: 500 }}>
                    {c.variable.replace(/\{\{|\}\}/g, '')}
                  </span>
                )}
                <span style={{ margin: '0 4px', color: '#dc2626' }}>
                  {OPERATOR_LABELS[c.operator] || c.operator || '?'}
                </span>
                <span style={{ color: '#555' }}>
                  {c.value !== undefined ? String(c.value) : '?'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#bbb', fontStyle: 'italic' }}>未配置条件</div>
        )}
      </BaseNode>

      {/* True / False handle 标签 */}
      <span style={{
        position: 'absolute', right: -44, top: '30%', transform: 'translateY(-50%)',
        fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4',
        padding: '1px 5px', borderRadius: 3, border: '1px solid #bbf7d0', lineHeight: '16px',
      }}>True</span>
      <span style={{
        position: 'absolute', right: -48, top: '70%', transform: 'translateY(-50%)',
        fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2',
        padding: '1px 5px', borderRadius: 3, border: '1px solid #fecaca', lineHeight: '16px',
      }}>False</span>

      <Handle type="source" position={Position.Right} id="true" style={{ top: '30%' }} />
      <Handle type="source" position={Position.Right} id="false" style={{ top: '70%' }} />
      <Handle type="target" position={Position.Left} />
    </div>
  );
};

export default memo(ConditionNode);

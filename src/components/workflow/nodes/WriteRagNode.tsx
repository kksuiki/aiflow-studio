import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FileAddOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

const WriteRagNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '写入RAG'} icon={<FileAddOutlined />} color="#d97706" width={240}>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(WriteRagNode);

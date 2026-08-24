import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { Endpoint } from '../../store/endpointStore';

interface APIGraphProps {
  endpoints: Endpoint[];
  onNodeClick?: (endpoint: Endpoint) => void;
  className?: string;
}

const methodColors: Record<string, string> = {
  GET: '#22c55e',
  POST: '#16a34a',
  PUT: '#f97316',
  PATCH: '#eab308',
  DELETE: '#ef4444',
};

function EndpointNode({ data }: { data: { endpoint: Endpoint } }) {
  const hasDrift = !!data.endpoint.lastDriftAt;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl border min-w-[180px] transition-all',
        hasDrift
          ? 'bg-orange-500/8 border-orange-500/30'
          : 'bg-white dark:bg-[#0a0a0a] border-neutral-200 dark:border-white/[0.08]'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="px-2 py-0.5 text-[11px] font-bold rounded"
          style={{
            backgroundColor: `${methodColors[data.endpoint.method]}15`,
            color: methodColors[data.endpoint.method],
          }}
        >
          {data.endpoint.method}
        </div>
        {hasDrift ? (
          <AlertTriangle className="w-4 h-4 text-orange-400" />
        ) : (
          <CheckCircle className="w-4 h-4 text-primary-400" />
        )}
      </div>
      <p className="text-sm font-medium text-white/80 truncate mb-1">
        {data.endpoint.name}
      </p>
      <p className="text-xs text-white/40 font-mono truncate">
        {data.endpoint.url}
      </p>
      <div className="flex items-center gap-1 mt-2 pt-2 border-t border-neutral-200 dark:border-white/[0.06]">
        <Clock className="w-3 h-3 text-white/25" />
        <span className="text-[10px] text-white/30">
          v{data.endpoint.currentSchemaVersion}
        </span>
      </div>
    </div>
  );
}

export function APIGraph({ endpoints, onNodeClick, className }: APIGraphProps) {
  const nodeTypes: NodeTypes = useMemo(
    () => ({ endpoint: EndpointNode }),
    []
  );

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = endpoints.map((endpoint, idx) => {
      const cols = 3;
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      return {
        id: endpoint.id,
        type: 'endpoint',
        position: { x: col * 250 + 50, y: row * 150 + 50 },
        data: { endpoint },
        draggable: true,
      };
    });

    const edges: Edge[] = [];
    const relationships = new Map<string, string[]>();

    endpoints.forEach((endpoint) => {
      endpoints.forEach((target) => {
        if (endpoint.id !== target.id && target.url.includes(endpoint.url.split('/')[1] || '')) {
          const existing = relationships.get(endpoint.id) || [];
          if (!existing.includes(target.id)) {
            existing.push(target.id);
            relationships.set(endpoint.id, existing);
          }
        }
      });
    });

    relationships.forEach((targets, sourceId) => {
      targets.slice(0, 2).forEach((targetId) => {
        edges.push({
          id: `${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: 'rgba(34, 197, 94, 0.25)', strokeWidth: 1.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: 'rgba(34, 197, 94, 0.25)',
          },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [endpoints]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClickHandler = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const endpoint = endpoints.find((e) => e.id === node.id);
      if (endpoint) {
        onNodeClick?.(endpoint);
      }
    },
    [endpoints, onNodeClick]
  );

  return (
    <div className={cn('rounded-xl border border-neutral-200 dark:border-white/[0.06] bg-black overflow-hidden', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
      >
        <Background color="rgba(255,255,255,0.03)" gap={20} size={1} />
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          className="!bg-white dark:bg-[#0a0a0a] !border-neutral-200 dark:border-white/[0.08] !rounded-lg"
        />
        <MiniMap
          nodeColor={(node) => {
            const endpoint = node.data?.endpoint as Endpoint | undefined;
            return endpoint?.lastDriftAt ? '#f97316' : '#22c55e';
          }}
          maskColor="rgba(0,0,0,0.85)"
          className="!bg-white dark:bg-white/[0.03] !border-neutral-200 dark:border-white/[0.08] !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}

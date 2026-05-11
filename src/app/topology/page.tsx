'use client';

import { useEffect, useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import {
  Cloud,
  Laptop,
  Network,
  Printer,
  Router,
  Server,
  Shield,
  Smartphone,
  Trash2,
  Wifi,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  Link2,
  X,
} from 'lucide-react';

type NodeType =
  | 'pc'
  | 'switch'
  | 'router'
  | 'server'
  | 'firewall'
  | 'printer'
  | 'phone'
  | 'cloud'
  | 'other';

type TopologyNode = {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
};

type TopologyLink = {
  id: string;
  from: string;
  to: string;
};

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type DragState = {
  nodeId: string;
  offsetX: number;
  offsetY: number;
};

type PaletteItem = {
  type: NodeType;
  label: string;
};

const STORAGE_KEY = 'mastermonitor-topology-builder-v1';

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'pc', label: 'PC' },
  { type: 'switch', label: 'Switch' },
  { type: 'router', label: 'Router' },
  { type: 'server', label: 'Serveur' },
  { type: 'firewall', label: 'Firewall' },
  { type: 'printer', label: 'Imprimante' },
  { type: 'phone', label: 'Téléphone IP' },
  { type: 'cloud', label: 'Cloud/Internet' },
  { type: 'other', label: 'Autre' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const nodeTypeColor: Record<NodeType, { bg: string; border: string }> = {
  pc: { bg: '#22c55e', border: '#15803d' },
  switch: { bg: '#06b6d4', border: '#0e7490' },
  router: { bg: '#3b82f6', border: '#1d4ed8' },
  server: { bg: '#6366f1', border: '#4338ca' },
  firewall: { bg: '#f97316', border: '#c2410c' },
  printer: { bg: '#8b5cf6', border: '#6d28d9' },
  phone: { bg: '#ec4899', border: '#be185d' },
  cloud: { bg: '#0ea5e9', border: '#0369a1' },
  other: { bg: '#64748b', border: '#334155' },
};

const NODE_WIDTH = 96;
const NODE_HEIGHT = 66;

const getLinkAnchor = (node: TopologyNode, other: TopologyNode) => {
  const cx = node.x + NODE_WIDTH / 2;
  const cy = node.y + NODE_HEIGHT / 2;
  const ocx = other.x + NODE_WIDTH / 2;
  const ocy = other.y + NODE_HEIGHT / 2;
  const dx = ocx - cx;
  const dy = ocy - cy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return {
      x: dx >= 0 ? node.x + NODE_WIDTH : node.x,
      y: cy,
    };
  }

  return {
    x: cx,
    y: dy >= 0 ? node.y + NODE_HEIGHT : node.y,
  };
};

const getLinkGeometry = (from: TopologyNode, to: TopologyNode) => {
  const start = getLinkAnchor(from, to);
  const end = getLinkAnchor(to, from);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    start,
    end,
    length,
    angle,
  };
};

const getIcon = (type: NodeType) => {
  switch (type) {
    case 'pc':
      return Laptop;
    case 'switch':
      return Network;
    case 'router':
      return Router;
    case 'server':
      return Server;
    case 'firewall':
      return Shield;
    case 'printer':
      return Printer;
    case 'phone':
      return Smartphone;
    case 'cloud':
      return Cloud;
    default:
      return Wifi;
  }
};

const nextLabel = (type: NodeType, nodes: TopologyNode[]) => {
  const base = PALETTE_ITEMS.find((i) => i.type === type)?.label || 'Équipement';
  const count = nodes.filter((n) => n.type === type).length + 1;
  return `${base} ${count}`;
};

export default function TopologyPage() {
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [links, setLinks] = useState<TopologyLink[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<DragState | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.nodes)) setNodes(parsed.nodes);
      if (Array.isArray(parsed?.links)) setLinks(parsed.links);
    } catch {
      // Ignore bad local cache
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, links }));
  }, [nodes, links]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) || null : null;

  const filteredNodeIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return new Set(nodes.map((n) => n.id));
    return new Set(
      nodes
        .filter((n) => `${n.label} ${n.type}`.toLowerCase().includes(q))
        .map((n) => n.id),
    );
  }, [nodes, search]);

  const visibleLinks = links.filter((l) => filteredNodeIds.has(l.from) && filteredNodeIds.has(l.to));

  const toWorld = (clientX: number, clientY: number, rect: DOMRect) => ({
    x: (clientX - rect.left - viewport.x) / viewport.scale,
    y: (clientY - rect.top - viewport.y) / viewport.scale,
  });

  const addNode = (type: NodeType, x: number, y: number) => {
    setNodes((prev) => [
      ...prev,
      {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        label: nextLabel(type, prev),
        x,
        y,
      },
    ]);
  };

  const addNodeAtCenter = (type: NodeType) => {
    const centerX = (760 - viewport.x) / viewport.scale;
    const centerY = (360 - viewport.y) / viewport.scale;
    addNode(type, centerX, centerY);
  };

  const onPaletteDragStart = (e: React.DragEvent<HTMLButtonElement>, type: NodeType) => {
    e.dataTransfer.setData('application/topology-node-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const onCanvasDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/topology-node-type') as NodeType;
    if (!type) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const point = toWorld(e.clientX, e.clientY, rect);
    addNode(type, point.x, point.y);
  };

  const onCanvasDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onNodeMouseDown = (e: React.MouseEvent<HTMLDivElement>, node: TopologyNode) => {
    e.stopPropagation();
    const rect = (e.currentTarget.parentElement?.parentElement as HTMLElement | null)?.getBoundingClientRect();
    if (!rect) return;

    const point = toWorld(e.clientX, e.clientY, rect);
    setDraggingNode({ nodeId: node.id, offsetX: point.x - node.x, offsetY: point.y - node.y });
    setSelectedNodeId(node.id);
  };

  const onCanvasMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if ((e.target as HTMLElement).closest('[data-topology-node="true"]')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
    setSelectedNodeId(null);
  };

  const onCanvasMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();

    if (draggingNode) {
      const point = toWorld(e.clientX, e.clientY, rect);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === draggingNode.nodeId
            ? { ...n, x: point.x - draggingNode.offsetX, y: point.y - draggingNode.offsetY }
            : n,
        ),
      );
      return;
    }

    if (isPanning && panStart) {
      setViewport((prev) => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
    }
  };

  const onCanvasMouseUp = () => {
    setDraggingNode(null);
    setIsPanning(false);
    setPanStart(null);
  };

  const onCanvasWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setViewport((prev) => ({ ...prev, scale: clamp(prev.scale + delta, 0.4, 2.4) }));
  };

  const addLink = (from: string, to: string) => {
    if (from === to) return;
    setLinks((prev) => {
      const exists = prev.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from));
      if (exists) return prev;
      return [...prev, { id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, from, to }];
    });
  };

  const onNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);

    if (!linkMode) return;
    if (!linkSourceId) {
      setLinkSourceId(nodeId);
      return;
    }

    if (linkSourceId === nodeId) {
      setLinkSourceId(null);
      return;
    }

    addLink(linkSourceId, nodeId);
    setLinkSourceId(null);
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setLinks((prev) => prev.filter((l) => l.from !== selectedNodeId && l.to !== selectedNodeId));
    setSelectedNodeId(null);
    if (linkSourceId === selectedNodeId) setLinkSourceId(null);
  };

  const clearAll = () => {
    setNodes([]);
    setLinks([]);
    setSelectedNodeId(null);
    setLinkSourceId(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent">Éditeur Topologie Réseau</h1>
            <p className="text-sm text-slate-600 mt-2">Crée ta topologie en glissant-déposant les équipements sur la carte interactive.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer les nœuds..."
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />

            <button
              onClick={() => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale + 0.1, 0.4, 2.4) }))}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              title="Zoom +"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale - 0.1, 0.4, 2.4) }))}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              title="Zoom -"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              title="Réinitialiser la vue"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => {
                setLinkMode((v) => !v);
                setLinkSourceId(null);
              }}
              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                linkMode
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title="Activer le mode liaison"
            >
              <span className="inline-flex items-center gap-1.5"><Link2 size={14} /> Lier</span>
            </button>

            <button
              onClick={clearAll}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <span className="inline-flex items-center gap-1.5"><X size={14} /> Vider</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_320px] gap-4">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Palette équipements</h2>
            <p className="text-xs text-slate-500 mt-1">Glisser-déposer sur la carte, ou cliquer sur + pour ajouter au centre.</p>

            <div className="mt-4 grid grid-cols-1 gap-2">
              {PALETTE_ITEMS.map((item) => {
                const Icon = getIcon(item.type);
                const colors = nodeTypeColor[item.type];
                return (
                  <button
                    key={item.type}
                    draggable
                    onDragStart={(e) => onPaletteDragStart(e, item.type)}
                    onClick={() => addNodeAtCenter(item.type)}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                        style={{ backgroundColor: colors.bg }}
                      >
                        <Icon size={15} color="white" />
                      </span>
                      {item.label}
                    </span>
                    <Plus size={14} className="text-slate-400" />
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Mode Lien</p>
              <p className="mt-1">1. Activer Lier</p>
              <p>2. Cliquer équipement source</p>
              <p>3. Cliquer équipement destination</p>
            </div>
          </aside>

          <div
            className="relative h-[66vh] min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            onDrop={onCanvasDrop}
            onDragOver={onCanvasDragOver}
            onMouseDown={onCanvasMouseDown}
            onMouseMove={onCanvasMouseMove}
            onMouseUp={onCanvasMouseUp}
            onMouseLeave={onCanvasMouseUp}
            onWheel={onCanvasWheel}
          >
            <div className="absolute left-3 top-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-600">
              Zone de carte: dépose les équipements ici.
            </div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:28px_28px] opacity-60" />

            <div
              className="absolute inset-0"
              style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0' }}
            >
              <div className="absolute inset-0 pointer-events-none">
                {visibleLinks.map((link) => {
                  const from = nodeMap.get(link.from);
                  const to = nodeMap.get(link.to);
                  if (!from || !to) return null;

                  const geometry = getLinkGeometry(from, to);
                  if (geometry.length < 2) return null;

                  return (
                    <div key={link.id}>
                      <div
                        className="absolute h-0 border-t-2 border-dashed border-cyan-500"
                        style={{
                          left: geometry.start.x,
                          top: geometry.start.y,
                          width: geometry.length,
                          transform: `rotate(${geometry.angle}deg)`,
                          transformOrigin: '0 0',
                          opacity: 0.95,
                        }}
                      />
                      <span
                        className="absolute h-2 w-2 rounded-full bg-cyan-500"
                        style={{ left: geometry.start.x - 4, top: geometry.start.y - 4 }}
                      />
                      <span
                        className="absolute h-2 w-2 rounded-full bg-cyan-500"
                        style={{ left: geometry.end.x - 4, top: geometry.end.y - 4 }}
                      />
                    </div>
                  );
                })}
              </div>

              {nodes.map((node) => {
                if (!filteredNodeIds.has(node.id)) return null;
                const Icon = getIcon(node.type);
                const colors = nodeTypeColor[node.type];
                const isSelected = selectedNodeId === node.id;
                const isSource = linkSourceId === node.id;

                return (
                  <div
                    key={node.id}
                    data-topology-node="true"
                    onMouseDown={(e) => onNodeMouseDown(e, node)}
                    onClick={() => onNodeClick(node.id)}
                    className="absolute w-24 cursor-move select-none rounded-xl border bg-white px-2 py-2 shadow-sm"
                    style={{
                      left: node.x,
                      top: node.y,
                      borderColor: isSource ? '#2563eb' : isSelected ? '#0f172a' : '#cbd5e1',
                      boxShadow: isSource
                        ? '0 0 0 2px rgba(37,99,235,0.2)'
                        : isSelected
                          ? '0 0 0 2px rgba(15,23,42,0.15)'
                          : undefined,
                    }}
                  >
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
                      <Icon size={16} color="white" />
                    </div>
                    <p className="mt-1 truncate text-center text-[11px] font-medium text-slate-700">{node.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="absolute bottom-3 left-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-1.5 text-xs text-slate-600">
              {linkMode
                ? linkSourceId
                  ? 'Clique un deuxième équipement pour créer le lien.'
                  : 'Mode liaison actif: clique un équipement source.'
                : 'Glisse des équipements puis déplace-les pour dessiner ta topologie.'}
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Propriétés</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[11px] text-slate-500">Nœuds</p>
                <p className="text-xl font-bold text-slate-900">{nodes.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[11px] text-slate-500">Liens</p>
                <p className="text-xl font-bold text-cyan-600">{links.length}</p>
              </div>
            </div>

            {!selectedNode && (
              <p className="mt-4 text-sm text-slate-500">Sélectionne un équipement pour le renommer ou le supprimer.</p>
            )}

            {selectedNode && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{selectedNode.type}</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nom</label>
                  <input
                    value={selectedNode.label}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNodes((prev) => prev.map((n) => (n.id === selectedNode.id ? { ...n, label: value } : n)));
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <button
                  onClick={deleteSelectedNode}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <span className="inline-flex items-center gap-1.5"><Trash2 size={14} /> Supprimer l'équipement</span>
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}

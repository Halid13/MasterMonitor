'use client';

import { useMemo, useState } from 'react';
import MainLayout from '@/components/MainLayout';
import { useDashboardStore } from '@/store/dashboard';
import { Equipment, IPAddress, Subnet } from '@/types';
import { Network, Search, ZoomIn, ZoomOut, RotateCcw, Router, Laptop, Server, Printer, Smartphone, Wifi } from 'lucide-react';

type TopologyNodeKind = 'core' | 'subnet' | 'equipment' | 'orphan';

type TopologyNode = {
  id: string;
  label: string;
  kind: TopologyNodeKind;
  x: number;
  y: number;
  meta?: Record<string, string | number | undefined>;
};

type TopologyLink = {
  id: string;
  from: string;
  to: string;
  kind: 'core-subnet' | 'subnet-equipment';
};

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

const ipToInt = (ip?: string): number | null => {
  if (!ip) return null;
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return ((parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
};

const isIpInSubnetRange = (ip?: string, subnet?: Subnet) => {
  if (!ip || !subnet) return false;
  const ipInt = ipToInt(ip);
  const startInt = ipToInt(subnet.rangeStart);
  const endInt = ipToInt(subnet.rangeEnd);
  if (ipInt === null || startInt === null || endInt === null) return false;
  return ipInt >= startInt && ipInt <= endInt;
};

const normalizeSubnetKey = (value?: string) => (value || '').trim();

const getEquipmentIcon = (type?: string) => {
  switch (type) {
    case 'server':
      return Server;
    case 'printer':
      return Printer;
    case 'phone':
      return Smartphone;
    case 'network':
      return Wifi;
    default:
      return Laptop;
  }
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function TopologyPage() {
  const { subnets, equipment, ipAddresses } = useDashboardStore();
  const [search, setSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  const graph = useMemo(() => {
    const core: TopologyNode = {
      id: 'core-network',
      label: 'Réseau principal',
      kind: 'core',
      x: 600,
      y: 360,
      meta: {
        subnets: subnets.length,
        equipments: equipment.length,
      },
    };

    const subnetMap = new Map<string, { name: string; subnet?: Subnet }>();
    for (const s of subnets) {
      subnetMap.set(normalizeSubnetKey(s.subnetCidr), {
        name: s.name || s.subnetCidr,
        subnet: s,
      });
    }

    for (const ip of ipAddresses) {
      const key = normalizeSubnetKey(ip.subnet);
      if (!key || subnetMap.has(key)) continue;
      subnetMap.set(key, { name: key });
    }

    const subnetEntries = Array.from(subnetMap.entries());
    const subnetCount = Math.max(subnetEntries.length, 1);

    const subnetNodes: TopologyNode[] = subnetEntries.map(([key, value], index) => {
      const angle = (Math.PI * 2 * index) / subnetCount;
      const radius = 220 + Math.min(120, subnetCount * 10);
      return {
        id: `subnet-${key}`,
        label: value.name,
        kind: 'subnet',
        x: core.x + Math.cos(angle) * radius,
        y: core.y + Math.sin(angle) * radius,
        meta: {
          cidr: key,
          allocation: value.subnet?.allocation,
          range: value.subnet ? `${value.subnet.rangeStart} - ${value.subnet.rangeEnd}` : undefined,
        },
      };
    });

    const ipByAddress = new Map<string, IPAddress>();
    for (const ip of ipAddresses) {
      ipByAddress.set(ip.address, ip);
    }

    const equipmentsBySubnet = new Map<string, Equipment[]>();
    const orphanEquipments: Equipment[] = [];

    for (const eq of equipment) {
      const fromIpRecord = eq.ipAddress ? ipByAddress.get(eq.ipAddress) : undefined;
      const ipSubnetKey = normalizeSubnetKey(fromIpRecord?.subnet);

      let resolvedSubnetKey = ipSubnetKey;
      if (!resolvedSubnetKey && eq.ipAddress) {
        const match = subnets.find((s) => isIpInSubnetRange(eq.ipAddress, s));
        resolvedSubnetKey = normalizeSubnetKey(match?.subnetCidr);
      }

      if (!resolvedSubnetKey || !subnetMap.has(resolvedSubnetKey)) {
        orphanEquipments.push(eq);
        continue;
      }

      const list = equipmentsBySubnet.get(resolvedSubnetKey) || [];
      list.push(eq);
      equipmentsBySubnet.set(resolvedSubnetKey, list);
    }

    const equipmentNodes: TopologyNode[] = [];
    const links: TopologyLink[] = [];

    for (const subnetNode of subnetNodes) {
      const subnetKey = subnetNode.meta?.cidr as string;
      links.push({
        id: `link-core-${subnetNode.id}`,
        from: core.id,
        to: subnetNode.id,
        kind: 'core-subnet',
      });

      const attachedEquipments = equipmentsBySubnet.get(subnetKey) || [];
      const ringRadius = 120;
      const total = Math.max(attachedEquipments.length, 1);

      attachedEquipments.forEach((eq, index) => {
        const angle = (Math.PI * 2 * index) / total;
        const node: TopologyNode = {
          id: `equipment-${eq.id}`,
          label: eq.name,
          kind: 'equipment',
          x: subnetNode.x + Math.cos(angle) * ringRadius,
          y: subnetNode.y + Math.sin(angle) * ringRadius,
          meta: {
            type: eq.type,
            status: eq.status,
            ip: eq.ipAddress,
            subnet: subnetKey,
          },
        };

        equipmentNodes.push(node);
        links.push({
          id: `link-subnet-${subnetKey}-${eq.id}`,
          from: subnetNode.id,
          to: node.id,
          kind: 'subnet-equipment',
        });
      });
    }

    const orphanNodes: TopologyNode[] = orphanEquipments.map((eq, index) => ({
      id: `orphan-${eq.id}`,
      label: eq.name,
      kind: 'orphan',
      x: 140 + (index % 4) * 130,
      y: 120 + Math.floor(index / 4) * 70,
      meta: {
        type: eq.type,
        status: eq.status,
        ip: eq.ipAddress,
        reason: 'Aucun sous-réseau associé',
      },
    }));

    return {
      nodes: [core, ...subnetNodes, ...equipmentNodes, ...orphanNodes],
      links,
      stats: {
        subnets: subnetNodes.length,
        equipmentsLinked: equipmentNodes.length,
        equipmentsOrphan: orphanNodes.length,
        links: links.length,
      },
    };
  }, [subnets, equipment, ipAddresses]);

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return graph.nodes;
    return graph.nodes.filter((node) => {
      const text = [
        node.label,
        node.meta?.cidr,
        node.meta?.type,
        node.meta?.status,
        node.meta?.ip,
        node.meta?.subnet,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [graph.nodes, search]);

  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  const visibleLinks = graph.links.filter((link) => visibleNodeIds.has(link.from) && visibleNodeIds.has(link.to));

  const nodeById = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    for (const node of graph.nodes) map.set(node.id, node);
    return map;
  }, [graph.nodes]);

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) || null : null;

  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setViewport((prev) => ({ ...prev, scale: clamp(prev.scale + delta, 0.5, 2.2) }));
  };

  const onMouseDown: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if ((e.target as HTMLElement).closest('[data-node="true"]')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - viewport.x, y: e.clientY - viewport.y });
  };

  const onMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (!isPanning || !panStart) return;
    setViewport((prev) => ({ ...prev, x: e.clientX - panStart.x, y: e.clientY - panStart.y }));
  };

  const onMouseUp = () => {
    setIsPanning(false);
    setPanStart(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent">Visualisation Topologique</h1>
            <p className="text-sm text-slate-600 mt-2">Schéma dynamique du réseau avec liens entre sous-réseaux et équipements.</p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Search size={16} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer (nom, IP, subnet...)"
              className="w-64 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Sous-réseaux</p>
            <p className="text-2xl font-bold text-slate-900">{graph.stats.subnets}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Équipements liés</p>
            <p className="text-2xl font-bold text-emerald-600">{graph.stats.equipmentsLinked}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Équipements orphelins</p>
            <p className="text-2xl font-bold text-amber-600">{graph.stats.equipmentsOrphan}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Liens</p>
            <p className="text-2xl font-bold text-indigo-600">{graph.stats.links}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="absolute right-3 top-3 z-20 flex gap-2">
              <button
                onClick={() => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale + 0.1, 0.5, 2.2) }))}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                title="Zoom +"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => setViewport((prev) => ({ ...prev, scale: clamp(prev.scale - 0.1, 0.5, 2.2) }))}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                title="Zoom -"
              >
                <ZoomOut size={16} />
              </button>
              <button
                onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
                className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                title="Réinitialiser"
              >
                <RotateCcw size={16} />
              </button>
            </div>

            <svg
              viewBox="0 0 1200 760"
              className="h-[68vh] min-h-[500px] w-full cursor-grab active:cursor-grabbing"
              onWheel={onWheel}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <defs>
                <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
              </defs>

              <rect width="1200" height="760" fill="url(#grid)" />

              <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
                {visibleLinks.map((link) => {
                  const from = nodeById.get(link.from);
                  const to = nodeById.get(link.to);
                  if (!from || !to) return null;

                  return (
                    <line
                      key={link.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={link.kind === 'core-subnet' ? '#6366f1' : '#38bdf8'}
                      strokeWidth={link.kind === 'core-subnet' ? 2.4 : 1.8}
                      strokeDasharray={link.kind === 'subnet-equipment' ? '5 4' : undefined}
                      opacity={0.8}
                    />
                  );
                })}

                {filteredNodes.map((node) => {
                  const isSelected = node.id === selectedNodeId;

                  const config =
                    node.kind === 'core'
                      ? { radius: 34, fill: '#1d4ed8', stroke: '#1e40af' }
                      : node.kind === 'subnet'
                        ? { radius: 24, fill: '#0ea5e9', stroke: '#0369a1' }
                        : node.kind === 'orphan'
                          ? { radius: 18, fill: '#f59e0b', stroke: '#b45309' }
                          : { radius: 16, fill: '#22c55e', stroke: '#15803d' };

                  return (
                    <g
                      key={node.id}
                      data-node="true"
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={config.radius + (isSelected ? 4 : 0)}
                        fill={config.fill}
                        stroke={isSelected ? '#111827' : config.stroke}
                        strokeWidth={isSelected ? 3 : 2}
                      />

                      {node.kind === 'core' && <Network x={node.x - 10} y={node.y - 10} size={20} color="white" />}
                      {node.kind === 'subnet' && <Router x={node.x - 9} y={node.y - 9} size={18} color="white" />}
                      {node.kind === 'equipment' && (() => {
                        const Icon = getEquipmentIcon(String(node.meta?.type || 'pc'));
                        return <Icon x={node.x - 8} y={node.y - 8} size={16} color="white" />;
                      })()}

                      {node.kind === 'orphan' && <Laptop x={node.x - 8} y={node.y - 8} size={16} color="white" />}

                      <text
                        x={node.x}
                        y={node.y + config.radius + 15}
                        textAnchor="middle"
                        className="fill-slate-700 text-[11px] font-medium"
                      >
                        {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Détails du nœud</h2>
            {!selectedNode && (
              <p className="mt-3 text-sm text-slate-500">Sélectionne un nœud sur la carte pour voir ses détails.</p>
            )}

            {selectedNode && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Nom</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{selectedNode.label}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Type</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">{selectedNode.kind}</p>
                </div>

                {Object.entries(selectedNode.meta || {}).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">{key}</p>
                    <p className="text-sm font-semibold text-slate-900 mt-1 break-all">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}

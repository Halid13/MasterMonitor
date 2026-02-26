import 'server-only';
import { PoolClient } from 'pg';
import { dbQuery, withTransaction } from '@/lib/postgres';

type AnyObject = Record<string, any>;

type SnapshotPayload = {
  users?: AnyObject[];
  equipment?: AnyObject[];
  servers?: AnyObject[];
  tickets?: AnyObject[];
  alerts?: AnyObject[];
  ipAddresses?: AnyObject[];
  subnets?: AnyObject[];
  pingResults?: AnyObject[];
  connectedUser?: string;
  realtime?: AnyObject;
  dynamic?: AnyObject;
  staticData?: AnyObject;
};

const asDate = (value: unknown) => {
  if (!value) return new Date();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const normalizeText = (value: unknown, fallback = '') => {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const upsertUser = async (client: PoolClient, user: AnyObject) => {
  await client.query(
    `
    INSERT INTO users (
      id, username, email, first_name, last_name, department, role, is_active, groups, last_login, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      department = EXCLUDED.department,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      groups = EXCLUDED.groups,
      last_login = EXCLUDED.last_login,
      updated_at = NOW()
    `,
    [
      normalizeText(user.id),
      normalizeText(user.username),
      normalizeText(user.email) || null,
      normalizeText(user.firstName) || null,
      normalizeText(user.lastName) || null,
      normalizeText(user.department) || null,
      normalizeText(user.role, 'user'),
      Boolean(user.isActive ?? true),
      Array.isArray(user.groups) ? user.groups.map((group) => String(group)) : [],
      user.lastLogin ? asDate(user.lastLogin) : null,
    ],
  );
};

const upsertEquipment = async (client: PoolClient, equipment: AnyObject) => {
  await client.query(
    `
    INSERT INTO equipment (
      id, name, type, serial_number, hardware_id, ip_address, status,
      assigned_to_user, department_service, location, network_config,
      inventory_meta, date_in_service, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      serial_number = EXCLUDED.serial_number,
      hardware_id = EXCLUDED.hardware_id,
      ip_address = EXCLUDED.ip_address,
      status = EXCLUDED.status,
      assigned_to_user = EXCLUDED.assigned_to_user,
      department_service = EXCLUDED.department_service,
      location = EXCLUDED.location,
      network_config = EXCLUDED.network_config,
      inventory_meta = EXCLUDED.inventory_meta,
      date_in_service = EXCLUDED.date_in_service,
      updated_at = NOW()
    `,
    [
      normalizeText(equipment.id),
      normalizeText(equipment.name),
      normalizeText(equipment.type, 'other'),
      normalizeText(equipment.serialNumber),
      normalizeText(equipment.hardwareId) || null,
      normalizeText(equipment.ipAddress) || null,
      normalizeText(equipment.status, 'stock'),
      normalizeText(equipment.assignedToUser) || null,
      normalizeText(equipment.departmentService) || null,
      normalizeText(equipment.location) || null,
      JSON.stringify(equipment.networkConfig || {}),
      JSON.stringify(equipment.inventoryMeta || {}),
      equipment.dateInService ? asDate(equipment.dateInService) : null,
    ],
  );
};

const upsertServer = async (client: PoolClient, server: AnyObject) => {
  await client.query(
    `
    INSERT INTO servers (
      id, name, ip_address, status, health_score,
      cpu_usage, memory_usage, disk_usage,
      network_in, network_out, process_count, uptime,
      services, last_health_check, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,
      $9,$10,$11,$12,
      $13::jsonb,$14,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      ip_address = EXCLUDED.ip_address,
      status = EXCLUDED.status,
      health_score = EXCLUDED.health_score,
      cpu_usage = EXCLUDED.cpu_usage,
      memory_usage = EXCLUDED.memory_usage,
      disk_usage = EXCLUDED.disk_usage,
      network_in = EXCLUDED.network_in,
      network_out = EXCLUDED.network_out,
      process_count = EXCLUDED.process_count,
      uptime = EXCLUDED.uptime,
      services = EXCLUDED.services,
      last_health_check = EXCLUDED.last_health_check,
      updated_at = NOW()
    `,
    [
      normalizeText(server.id),
      normalizeText(server.name, normalizeText(server.host, 'Unknown')),
      normalizeText(server.ipAddress, normalizeText(server.ip, '0.0.0.0')),
      normalizeText(server.status, 'offline'),
      Number(server.healthScore ?? 0),
      Number(server.metrics?.cpuUsage ?? server.cpu ?? 0),
      Number(server.metrics?.memoryUsage ?? server.memory ?? 0),
      Number(server.metrics?.diskUsage ?? server.disk ?? 0),
      Number(server.metrics?.networkIn ?? server.network?.incoming ?? 0),
      Number(server.metrics?.networkOut ?? server.network?.outgoing ?? 0),
      Number(server.metrics?.processCount ?? 0),
      Number(server.metrics?.uptime ?? server.uptime ?? 0),
      JSON.stringify(server.services || []),
      server.lastHealthCheck ? asDate(server.lastHealthCheck) : new Date(),
    ],
  );
};

const upsertTicket = async (client: PoolClient, ticket: AnyObject) => {
  const existing = await client.query<{ status: string }>('SELECT status FROM tickets WHERE id = $1', [normalizeText(ticket.id)]);

  await client.query(
    `
    INSERT INTO tickets (
      id, title, description, priority, status, category,
      created_by, assigned_to, comments, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9::jsonb,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      priority = EXCLUDED.priority,
      status = EXCLUDED.status,
      category = EXCLUDED.category,
      created_by = EXCLUDED.created_by,
      assigned_to = EXCLUDED.assigned_to,
      comments = EXCLUDED.comments,
      updated_at = NOW()
    `,
    [
      normalizeText(ticket.id),
      normalizeText(ticket.title),
      normalizeText(ticket.description) || null,
      normalizeText(ticket.priority, 'medium'),
      normalizeText(ticket.status, 'open'),
      normalizeText(ticket.category, 'other'),
      normalizeText(ticket.createdBy, 'system'),
      normalizeText(ticket.assignedTo) || null,
      JSON.stringify(ticket.comments || []),
    ],
  );

  const oldStatus = existing.rows[0]?.status;
  const newStatus = normalizeText(ticket.status, 'open');
  if (oldStatus && oldStatus !== newStatus) {
    await client.query(
      `
      INSERT INTO ticket_status_history (id, ticket_id, old_status, new_status, changed_by, changed_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        `tsh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        normalizeText(ticket.id),
        oldStatus,
        newStatus,
        normalizeText(ticket.updatedBy || ticket.createdBy, 'system'),
      ],
    );
  }
};

const upsertAlert = async (client: PoolClient, alert: AnyObject) => {
  await client.query(
    `
    INSERT INTO alerts (id, title, message, type, source, is_resolved, created_at, resolved_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      type = EXCLUDED.type,
      source = EXCLUDED.source,
      is_resolved = EXCLUDED.is_resolved,
      resolved_at = EXCLUDED.resolved_at,
      updated_at = NOW()
    `,
    [
      normalizeText(alert.id),
      normalizeText(alert.title),
      normalizeText(alert.message),
      normalizeText(alert.type, 'warning'),
      normalizeText(alert.source, 'System'),
      Boolean(alert.isResolved ?? false),
      alert.createdAt ? asDate(alert.createdAt) : new Date(),
      alert.resolvedAt ? asDate(alert.resolvedAt) : null,
    ],
  );
};

const upsertIp = async (client: PoolClient, ip: AnyObject) => {
  await client.query(
    `
    INSERT INTO ip_addresses (
      id, address, subnet, gateway, dns_servers,
      is_active, assigned_to, ip_status, last_seen, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      address = EXCLUDED.address,
      subnet = EXCLUDED.subnet,
      gateway = EXCLUDED.gateway,
      dns_servers = EXCLUDED.dns_servers,
      is_active = EXCLUDED.is_active,
      assigned_to = EXCLUDED.assigned_to,
      ip_status = EXCLUDED.ip_status,
      last_seen = EXCLUDED.last_seen,
      updated_at = NOW()
    `,
    [
      normalizeText(ip.id),
      normalizeText(ip.address),
      normalizeText(ip.subnet),
      normalizeText(ip.gateway),
      Array.isArray(ip.dnsServers) ? ip.dnsServers.map((item) => String(item)) : [],
      Boolean(ip.isActive ?? false),
      normalizeText(ip.assignedTo) || null,
      normalizeText(ip.ipStatus, ip.isActive ? 'used' : 'free'),
      ip.lastSeen ? asDate(ip.lastSeen) : null,
    ],
  );
};

const upsertSubnet = async (client: PoolClient, subnet: AnyObject) => {
  await client.query(
    `
    INSERT INTO subnets (
      id, name, main_network_cidr, subnet_cidr, network_address,
      prefix, netmask, range_start, range_end, usable_hosts,
      allocation, updated_at
    ) VALUES (
      $1,$2,$3,$4,$5,
      $6,$7,$8,$9,$10,
      $11,NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      main_network_cidr = EXCLUDED.main_network_cidr,
      subnet_cidr = EXCLUDED.subnet_cidr,
      network_address = EXCLUDED.network_address,
      prefix = EXCLUDED.prefix,
      netmask = EXCLUDED.netmask,
      range_start = EXCLUDED.range_start,
      range_end = EXCLUDED.range_end,
      usable_hosts = EXCLUDED.usable_hosts,
      allocation = EXCLUDED.allocation,
      updated_at = NOW()
    `,
    [
      normalizeText(subnet.id),
      normalizeText(subnet.name),
      normalizeText(subnet.mainNetworkCidr),
      normalizeText(subnet.subnetCidr),
      normalizeText(subnet.networkAddress),
      Number(subnet.prefix ?? 24),
      normalizeText(subnet.netmask),
      normalizeText(subnet.rangeStart),
      normalizeText(subnet.rangeEnd),
      Number(subnet.usableHosts ?? 0),
      normalizeText(subnet.allocation),
    ],
  );
};

const insertPing = async (client: PoolClient, ping: AnyObject) => {
  await client.query(
    `
    INSERT INTO ping_results (
      id, target, reachable, avg_latency_ms, sent, received, elapsed_ms, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    `,
    [
      normalizeText(ping.id, `ping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      normalizeText(ping.target),
      Boolean(ping.reachable ?? false),
      ping.avgLatencyMs == null ? null : Number(ping.avgLatencyMs),
      Number(ping.sent ?? 0),
      Number(ping.received ?? 0),
      ping.elapsedMs == null ? null : Number(ping.elapsedMs),
    ],
  );
};

const saveSnapshotDocument = async (client: PoolClient, category: string, payload: AnyObject) => {
  await client.query(
    `
    INSERT INTO monitoring_snapshots (category, payload, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (category) DO UPDATE SET
      payload = EXCLUDED.payload,
      updated_at = NOW()
    `,
    [category, JSON.stringify(payload || {})],
  );
};

export const persistMonitoringSnapshot = async (payload: SnapshotPayload) => {
  const stats = {
    users: payload.users?.length || 0,
    equipment: payload.equipment?.length || 0,
    servers: payload.servers?.length || 0,
    tickets: payload.tickets?.length || 0,
    alerts: payload.alerts?.length || 0,
    ipAddresses: payload.ipAddresses?.length || 0,
    subnets: payload.subnets?.length || 0,
    pingResults: payload.pingResults?.length || 0,
  };

  await withTransaction(async (client) => {
    for (const user of payload.users || []) await upsertUser(client, user);
    for (const item of payload.equipment || []) await upsertEquipment(client, item);
    for (const server of payload.servers || []) await upsertServer(client, server);
    for (const ticket of payload.tickets || []) await upsertTicket(client, ticket);
    for (const alert of payload.alerts || []) await upsertAlert(client, alert);
    for (const ip of payload.ipAddresses || []) await upsertIp(client, ip);
    for (const subnet of payload.subnets || []) await upsertSubnet(client, subnet);
    for (const ping of payload.pingResults || []) await insertPing(client, ping);

    if (payload.connectedUser) {
      await client.query(
        `
        INSERT INTO runtime_state (state_key, state_value, updated_at)
        VALUES ('connected_user', $1::jsonb, NOW())
        ON CONFLICT (state_key) DO UPDATE SET
          state_value = EXCLUDED.state_value,
          updated_at = NOW()
        `,
        [JSON.stringify({ username: payload.connectedUser })],
      );
    }

    await saveSnapshotDocument(client, 'realtime', payload.realtime || {});
    await saveSnapshotDocument(client, 'dynamic', payload.dynamic || {});
    await saveSnapshotDocument(client, 'static', payload.staticData || {});
  });

  return stats;
};

export const getRealtimeMonitoringData = async () => {
  const [servers, ticketUpdates, alerts, pingRows, ipStatusRows, connected] = await Promise.all([
    dbQuery(
      `
      SELECT id, name, ip_address, status, cpu_usage, memory_usage, disk_usage, services, updated_at
      FROM servers
      ORDER BY updated_at DESC
      `,
    ),
    dbQuery(
      `
      SELECT ticket_id, old_status, new_status, changed_by, changed_at
      FROM ticket_status_history
      ORDER BY changed_at DESC
      LIMIT 50
      `,
    ),
    dbQuery(
      `
      SELECT id, title, message, type, source, is_resolved, created_at
      FROM alerts
      WHERE is_resolved = FALSE
      ORDER BY created_at DESC
      LIMIT 100
      `,
    ),
    dbQuery(
      `
      SELECT id, target, reachable, avg_latency_ms, sent, received, elapsed_ms, created_at
      FROM ping_results
      ORDER BY created_at DESC
      LIMIT 50
      `,
    ),
    dbQuery(
      `
      WITH ip_dups AS (
        SELECT address, COUNT(*) AS c
        FROM ip_addresses
        GROUP BY address
      )
      SELECT i.id, i.address, i.assigned_to, i.is_active,
             CASE
               WHEN d.c > 1 THEN 'conflict'
               WHEN i.is_active THEN 'used'
               ELSE 'free'
             END AS ip_status,
             i.updated_at
      FROM ip_addresses i
      LEFT JOIN ip_dups d ON d.address = i.address
      ORDER BY i.updated_at DESC
      `,
    ),
    dbQuery<{ state_value: AnyObject }>(
      `SELECT state_value FROM runtime_state WHERE state_key = 'connected_user' LIMIT 1`,
    ),
  ]);

  const openTickets = await dbQuery(
    `
    SELECT id, title, status, priority, category, updated_at
    FROM tickets
    WHERE status IN ('open', 'in-progress', 'waiting')
    ORDER BY updated_at DESC
    LIMIT 100
    `,
  );

  return {
    generatedAt: new Date().toISOString(),
    realtime: {
      machineStatus: servers.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        ipAddress: row.ip_address,
        status: row.status,
      })),
      currentIpAddresses: servers.rows.map((row: any) => ({
        serverId: row.id,
        ipAddress: row.ip_address,
      })),
      ipStatus: ipStatusRows.rows,
      serverState: servers.rows.map((row: any) => ({
        serverId: row.id,
        cpu: row.cpu_usage,
        ram: row.memory_usage,
        disk: row.disk_usage,
        updatedAt: row.updated_at,
      })),
      serviceAvailability: servers.rows.map((row: any) => ({
        serverId: row.id,
        services: row.services || [],
      })),
      newHelpdeskTickets: openTickets.rows,
      ticketStatusChanges: ticketUpdates.rows,
      systemAlerts: alerts.rows,
      pingResults: pingRows.rows,
      connectedUser: connected.rows[0]?.state_value?.username || null,
    },
  };
};

export const getDynamicMonitoringData = async () => {
  const [equipmentRows, ipRows, subnetRows] = await Promise.all([
    dbQuery(
      `
      SELECT id, name, assigned_to_user, status, location, updated_at
      FROM equipment
      ORDER BY updated_at DESC
      `,
    ),
    dbQuery(
      `
      SELECT id, address, assigned_to, ip_status, updated_at
      FROM ip_addresses
      ORDER BY updated_at DESC
      `,
    ),
    dbQuery(
      `
      SELECT s.id, s.name, s.usable_hosts,
             COUNT(i.id) FILTER (WHERE i.is_active = TRUE) AS used_hosts,
             COUNT(i.id) FILTER (WHERE i.is_active = FALSE) AS free_hosts
      FROM subnets s
      LEFT JOIN ip_addresses i ON i.subnet = s.subnet_cidr
      GROUP BY s.id, s.name, s.usable_hosts
      ORDER BY s.name ASC
      `,
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    dynamic: {
      machinesAssignedToUser: equipmentRows.rows.map((row: any) => ({
        equipmentId: row.id,
        equipmentName: row.name,
        assignedToUser: row.assigned_to_user,
      })),
      ipsAssignedToMachine: ipRows.rows,
      equipmentStatus: equipmentRows.rows.map((row: any) => ({
        equipmentId: row.id,
        status: row.status,
        updatedAt: row.updated_at,
      })),
      subnetOccupation: subnetRows.rows.map((row: any) => ({
        subnetId: row.id,
        subnetName: row.name,
        usableHosts: Number(row.usable_hosts || 0),
        usedHosts: Number(row.used_hosts || 0),
        freeHosts: Number(row.free_hosts || 0),
      })),
      equipmentLocation: equipmentRows.rows.map((row: any) => ({
        equipmentId: row.id,
        location: row.location,
      })),
    },
  };
};

export const getStaticMonitoringData = async () => {
  const [machines, users, tickets, changes, inventory] = await Promise.all([
    dbQuery(
      `
      SELECT id, name, ip_address, services, created_at, updated_at
      FROM servers
      ORDER BY name ASC
      `,
    ),
    dbQuery(
      `
      SELECT id, username, department, groups, role, created_at
      FROM users
      ORDER BY username ASC
      `,
    ),
    dbQuery(
      `
      SELECT id, title, status, priority, category, created_at, updated_at, comments
      FROM tickets
      ORDER BY updated_at DESC
      `,
    ),
    dbQuery(
      `
      SELECT id, ticket_id, old_status, new_status, changed_by, changed_at
      FROM ticket_status_history
      ORDER BY changed_at DESC
      LIMIT 300
      `,
    ),
    dbQuery(
      `
      SELECT id, name, type, serial_number, hardware_id, department_service, network_config, inventory_meta
      FROM equipment
      ORDER BY name ASC
      `,
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    staticData: {
      machines: machines.rows,
      users: users.rows,
      ticketHistory: tickets.rows,
      changeHistory: changes.rows,
      hardwareInventory: inventory.rows,
    },
  };
};

export const getFilteredLogs = async (params: {
  mode?: 'recent' | 'critical' | 'error' | 'security';
  limit?: number;
  offset?: number;
}) => {
  const limit = Math.max(1, Math.min(500, Number(params.limit || 100)));
  const offset = Math.max(0, Number(params.offset || 0));

  const where: string[] = [];
  const values: any[] = [];

  if (params.mode === 'critical') {
    values.push('critical');
    where.push(`level = $${values.length}`);
  } else if (params.mode === 'error') {
    values.push('error');
    where.push(`level = $${values.length}`);
  } else if (params.mode === 'security') {
    values.push('security');
    where.push(`category = $${values.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  values.push(limit);
  values.push(offset);

  const listQuery = `
    SELECT id, timestamp, username, action, module, ip_source, level, category, object_impacted, details
    FROM logs
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

  const countValues = values.slice(0, values.length - 2);
  const countQuery = `SELECT COUNT(*)::int AS total FROM logs ${whereClause}`;

  const [logs, count] = await Promise.all([
    dbQuery(listQuery, values),
    dbQuery<{ total: number }>(countQuery, countValues),
  ]);

  return {
    total: count.rows[0]?.total || 0,
    limit,
    offset,
    logs: logs.rows,
  };
};

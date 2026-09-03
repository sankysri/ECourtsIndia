import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { isDbConnected, pool, query } from '../config/database.js';
import { logger } from '../utils/logger.js';

/**
 * In-Memory Datastore Fallback & Unified DB Data Access Layer
 */
class MemoryDataStore {
  constructor() {
    this.roles = new Map();
    this.permissions = new Map();
    this.rolePermissions = new Map();
    this.users = new Map();
    this.userRoles = new Map();
    this.auditLogs = [];
    this.systemSettings = new Map();
    this.states = new Map();
    this.districts = new Map();
    this.courts = new Map();
    this.apiEnums = new Map();
    this.apiRequestLogs = [];
    this.caseRegistry = new Map();
    this.discoveryJobs = new Map();

    // M4, M5, M6 stores
    this.rawApiResponses = new Map();
    this.cases = new Map();
    this.caseParties = new Map();
    this.advocates = new Map();
    this.caseAdvocates = new Map();
    this.judges = new Map();
    this.caseJudges = new Map();
    this.caseHearings = new Map();
    this.caseOrders = new Map();
    this.caseJudgments = new Map();
    this.backfillCampaigns = new Map();
    this.dailyDiscoveryRuns = new Map(); // id -> run
  }

  reset() {
    this.roles.clear();
    this.permissions.clear();
    this.rolePermissions.clear();
    this.users.clear();
    this.userRoles.clear();
    this.auditLogs = [];
    this.systemSettings.clear();
    this.states.clear();
    this.districts.clear();
    this.courts.clear();
    this.apiEnums.clear();
    this.apiRequestLogs = [];
    this.caseRegistry.clear();
    this.discoveryJobs.clear();

    this.rawApiResponses.clear();
    this.cases.clear();
    this.caseParties.clear();
    this.advocates.clear();
    this.caseAdvocates.clear();
    this.judges.clear();
    this.caseJudges.clear();
    this.caseHearings.clear();
    this.caseOrders.clear();
    this.caseJudgments.clear();
    this.backfillCampaigns.clear();
    this.dailyDiscoveryRuns.clear();
  }
}

export const memStore = new MemoryDataStore();

export const db = {
  // Roles
  async getRoles() {
    if (isDbConnected) {
      const res = await query('SELECT * FROM roles ORDER BY name ASC');
      return res.rows;
    }
    return Array.from(memStore.roles.values());
  },

  async findRoleByName(name) {
    if (isDbConnected) {
      const res = await query('SELECT * FROM roles WHERE name = $1', [name]);
      return res.rows[0] || null;
    }
    return Array.from(memStore.roles.values()).find((r) => r.name === name) || null;
  },

  async createRole(role) {
    const id = role.id || uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        'INSERT INTO roles (id, name, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO UPDATE SET description = $3 RETURNING *',
        [id, role.name, role.description, now, now]
      );
      return res.rows[0];
    }
    const record = { id, name: role.name, description: role.description, created_at: now, updated_at: now };
    memStore.roles.set(role.name, record);
    return record;
  },

  // Permissions
  async createPermission(perm) {
    const id = perm.id || uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        'INSERT INTO permissions (id, name, module, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO UPDATE SET description = $4 RETURNING *',
        [id, perm.name, perm.module, perm.description, now, now]
      );
      return res.rows[0];
    }
    const record = { id, name: perm.name, module: perm.module, description: perm.description, created_at: now, updated_at: now };
    memStore.permissions.set(perm.name, record);
    return record;
  },

  async assignPermissionToRole(roleName, permissionName) {
    if (isDbConnected) {
      const roleRes = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
      const permRes = await query('SELECT id FROM permissions WHERE name = $1', [permissionName]);
      if (roleRes.rows[0] && permRes.rows[0]) {
        await query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [roleRes.rows[0].id, permRes.rows[0].id]
        );
      }
      return;
    }
    const current = memStore.rolePermissions.get(roleName) || new Set();
    current.add(permissionName);
    memStore.rolePermissions.set(roleName, current);
  },

  // Users
  async findUserByEmail(email) {
    const normalizedEmail = email.toLowerCase().trim();
    if (isDbConnected) {
      const res = await query('SELECT * FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
      if (!res.rows[0]) return null;
      const user = res.rows[0];
      const rolesRes = await query(
        'SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1',
        [user.id]
      );
      user.roles = rolesRes.rows.map((r) => r.name);
      return user;
    }
    const user = Array.from(memStore.users.values()).find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    if (!user) return null;
    user.roles = Array.from(memStore.userRoles.get(user.id) || ['READ_ONLY']);
    return { ...user };
  },

  async findUserById(id) {
    if (isDbConnected) {
      const res = await query('SELECT * FROM users WHERE id = $1', [id]);
      if (!res.rows[0]) return null;
      const user = res.rows[0];
      const rolesRes = await query(
        'SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1',
        [user.id]
      );
      user.roles = rolesRes.rows.map((r) => r.name);
      return user;
    }
    const user = memStore.users.get(id);
    if (!user) return null;
    user.roles = Array.from(memStore.userRoles.get(user.id) || ['READ_ONLY']);
    return { ...user };
  },

  async createUser(userData, roleNames = ['READ_ONLY']) {
    const id = userData.id || uuidv4();
    const now = new Date();
    const normalizedEmail = userData.email.toLowerCase().trim();

    if (isDbConnected) {
      const res = await query(
        'INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [id, normalizedEmail, userData.password_hash, userData.first_name, userData.last_name, userData.is_active ?? true, now, now]
      );
      const user = res.rows[0];
      for (const roleName of roleNames) {
        const roleRes = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
        if (roleRes.rows[0]) {
          await query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, roleRes.rows[0].id]);
        }
      }
      user.roles = roleNames;
      return user;
    }

    const user = {
      id,
      email: normalizedEmail,
      password_hash: userData.password_hash,
      first_name: userData.first_name,
      last_name: userData.last_name,
      is_active: userData.is_active ?? true,
      refresh_token: null,
      last_login_at: null,
      created_at: now,
      updated_at: now,
    };
    memStore.users.set(id, user);
    memStore.userRoles.set(id, new Set(roleNames));
    return { ...user, roles: roleNames };
  },

  async updateUserLogin(userId) {
    const now = new Date();
    if (isDbConnected) {
      await query('UPDATE users SET last_login_at = $1, updated_at = $1 WHERE id = $2', [now, userId]);
      return;
    }
    const user = memStore.users.get(userId);
    if (user) {
      user.last_login_at = now;
      user.updated_at = now;
    }
  },

  async updateUserRefreshToken(userId, refreshToken) {
    const now = new Date();
    if (isDbConnected) {
      await query('UPDATE users SET refresh_token = $1, updated_at = $2 WHERE id = $3', [refreshToken, now, userId]);
      return;
    }
    const user = memStore.users.get(userId);
    if (user) {
      user.refresh_token = refreshToken;
      user.updated_at = now;
    }
  },

  // Audit Logs
  async createAuditLog({ userId, action, entity, entityId, details, ipAddress, userAgent }) {
    const id = uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        'INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details, ip_address, user_agent, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [id, userId || null, action, entity, entityId || null, JSON.stringify(details || {}), ipAddress || null, userAgent || null, now]
      );
      return res.rows[0];
    }
    const log = {
      id,
      user_id: userId || null,
      action,
      entity,
      entity_id: entityId || null,
      details: details || {},
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      created_at: now,
    };
    memStore.auditLogs.unshift(log);
    if (memStore.auditLogs.length > 500) memStore.auditLogs.pop();
    return log;
  },

  async getAuditLogs(limitOrOptions = 50, offsetArg = 0, entityArg = null, entityIdArg = null) {
    let limit = 50;
    let offset = 0;
    let entity = null;
    let entityId = null;

    if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
      limit = parseInt(limitOrOptions.limit ?? 50, 10);
      offset = parseInt(limitOrOptions.offset ?? 0, 10);
      entity = limitOrOptions.entity ?? null;
      entityId = limitOrOptions.entityId ?? null;
    } else {
      limit = parseInt(limitOrOptions ?? 50, 10);
      offset = parseInt(offsetArg ?? 0, 10);
      entity = entityArg ?? null;
      entityId = entityIdArg ?? null;
    }

    if (isDbConnected) {
      let where = [];
      let params = [];
      let idx = 1;
      if (entity) {
        where.push(`al.entity = $${idx}`);
        params.push(entity);
        idx++;
      }
      if (entityId) {
        where.push(`al.entity_id = $${idx}`);
        params.push(entityId);
        idx++;
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const res = await query(
        `SELECT al.*, u.email as user_email, u.first_name, u.last_name 
         FROM audit_logs al 
         LEFT JOIN users u ON u.id = al.user_id 
         ${whereSql}
         ORDER BY al.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );
      return res.rows;
    }
    let list = [...memStore.auditLogs];
    if (entity) list = list.filter((l) => l.entity === entity);
    if (entityId) list = list.filter((l) => l.entity_id === entityId);
    return list.slice(offset, offset + limit).map((log) => {
      const user = log.user_id ? memStore.users.get(log.user_id) : null;
      return {
        ...log,
        user_email: user?.email || 'system',
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
      };
    });
  },

  // System Settings
  async getSettings() {
    if (isDbConnected) {
      const res = await query('SELECT * FROM system_settings ORDER BY key ASC');
      return res.rows;
    }
    return Array.from(memStore.systemSettings.values());
  },

  async getSettingByKey(key) {
    if (isDbConnected) {
      const res = await query('SELECT * FROM system_settings WHERE key = $1', [key]);
      return res.rows[0] || null;
    }
    return memStore.systemSettings.get(key) || null;
  },

  async setSetting(key, value, description = '', isPublic = false) {
    const id = uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        `INSERT INTO system_settings (id, key, value, description, is_public, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (key) DO UPDATE SET value = $3, description = $4, is_public = $5, updated_at = $7
         RETURNING *`,
        [id, key, JSON.stringify(value), description, isPublic, now, now]
      );
      return res.rows[0];
    }
    const record = { id, key, value, description, is_public: isPublic, created_at: now, updated_at: now };
    memStore.systemSettings.set(key, record);
    return record;
  },

  // States
  async upsertState({ code, name }) {
    const id = uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        `INSERT INTO states (id, code, name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name = $3, updated_at = $5
         RETURNING *`,
        [id, code, name, now, now]
      );
      return res.rows[0];
    }
    const existing = memStore.states.get(code);
    if (existing) {
      existing.name = name;
      existing.updated_at = now;
      return existing;
    }
    const record = { id, code, name, created_at: now, updated_at: now };
    memStore.states.set(code, record);
    return record;
  },

  async getStates() {
    if (isDbConnected) {
      const res = await query('SELECT * FROM states ORDER BY name ASC');
      return res.rows;
    }
    return Array.from(memStore.states.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  async findStateByCode(code) {
    if (isDbConnected) {
      const res = await query('SELECT * FROM states WHERE code = $1', [code]);
      return res.rows[0] || null;
    }
    return memStore.states.get(code) || null;
  },

  // Districts
  async upsertDistrict({ stateId, code, name }) {
    const id = uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        `INSERT INTO districts (id, state_id, code, name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (state_id, code) DO UPDATE SET name = $4, updated_at = $6
         RETURNING *`,
        [id, stateId, code, name, now, now]
      );
      return res.rows[0];
    }
    const existing = Array.from(memStore.districts.values()).find(
      (d) => d.state_id === stateId && d.code === code
    );
    if (existing) {
      existing.name = name;
      existing.updated_at = now;
      return existing;
    }
    const record = { id, state_id: stateId, code, name, created_at: now, updated_at: now };
    memStore.districts.set(id, record);
    return record;
  },

  // Courts
  async upsertCourt({ stateId, districtId = null, code, name, type, parentCourtId = null, status = 'ACTIVE', metadata = {} }) {
    const id = uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        `INSERT INTO courts (id, state_id, district_id, code, name, type, parent_court_id, status, last_sync_at, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (code) DO UPDATE SET 
           state_id = $2,
           district_id = $3,
           name = $5,
           type = $6,
           parent_court_id = $7,
           status = $8,
           last_sync_at = $9,
           metadata = $10,
           updated_at = $12
         RETURNING *`,
        [id, stateId, districtId, code, name, type, parentCourtId, status, now, JSON.stringify(metadata), now, now]
      );
      return res.rows[0];
    }

    const existing = memStore.courts.get(code);
    if (existing) {
      existing.state_id = stateId;
      existing.district_id = districtId;
      existing.name = name;
      existing.type = type;
      existing.parent_court_id = parentCourtId;
      existing.status = status;
      existing.last_sync_at = now;
      existing.metadata = metadata;
      existing.updated_at = now;
      return existing;
    }

    const record = {
      id,
      state_id: stateId,
      district_id: districtId,
      code,
      name,
      type,
      parent_court_id: parentCourtId,
      status,
      total_cases: 0,
      last_sync_at: now,
      metadata,
      created_at: now,
      updated_at: now,
    };
    memStore.courts.set(code, record);
    return record;
  },

  async findCourtById(id) {
    if (isDbConnected) {
      const res = await query(
        `SELECT c.*, s.name as state_name, s.code as state_code, d.name as district_name, d.code as district_code,
                p.name as parent_court_name
         FROM courts c
         LEFT JOIN states s ON s.id = c.state_id
         LEFT JOIN districts d ON d.id = c.district_id
         LEFT JOIN courts p ON p.id = c.parent_court_id
         WHERE c.id = $1`,
        [id]
      );
      return res.rows[0] || null;
    }

    const court = Array.from(memStore.courts.values()).find((c) => c.id === id);
    if (!court) return null;
    const state = Array.from(memStore.states.values()).find((s) => s.id === court.state_id);
    const district = court.district_id ? memStore.districts.get(court.district_id) : null;
    const parent = court.parent_court_id
      ? Array.from(memStore.courts.values()).find((c) => c.id === court.parent_court_id)
      : null;

    return {
      ...court,
      state_name: state?.name || '',
      state_code: state?.code || '',
      district_name: district?.name || '',
      district_code: district?.code || '',
      parent_court_name: parent?.name || null,
    };
  },

  async findCourtByCode(code) {
    if (isDbConnected) {
      const res = await query('SELECT * FROM courts WHERE code = $1', [code]);
      return res.rows[0] || null;
    }
    return memStore.courts.get(code) || null;
  },

  async getCourts({ search = '', stateCode = '', districtCode = '', type = '', status = '', sortBy = 'name', sortOrder = 'ASC', limit = 20, offset = 0 } = {}) {
    if (isDbConnected) {
      let whereClauses = [];
      let params = [];
      let paramIndex = 1;

      if (search) {
        whereClauses.push(`(c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex} OR d.name ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
        paramIndex++;
      }
      if (stateCode) {
        whereClauses.push(`s.code = $${paramIndex}`);
        params.push(stateCode);
        paramIndex++;
      }
      if (districtCode) {
        whereClauses.push(`d.code = $${paramIndex}`);
        params.push(districtCode);
        paramIndex++;
      }
      if (type) {
        whereClauses.push(`c.type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }
      if (status) {
        whereClauses.push(`c.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const orderCol = ['name', 'code', 'type', 'total_cases', 'last_sync_at', 'created_at'].includes(sortBy) ? `c.${sortBy}` : 'c.name';
      const orderDir = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const countRes = await query(
        `SELECT COUNT(*) as total FROM courts c 
         LEFT JOIN states s ON s.id = c.state_id 
         LEFT JOIN districts d ON d.id = c.district_id 
         ${whereSql}`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await query(
        `SELECT c.*, s.name as state_name, s.code as state_code, d.name as district_name, d.code as district_code,
                p.name as parent_court_name
         FROM courts c
         LEFT JOIN states s ON s.id = c.state_id 
         LEFT JOIN districts d ON d.id = c.district_id 
         LEFT JOIN courts p ON p.id = c.parent_court_id 
         ${whereSql}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );

      return { courts: dataRes.rows, total, limit, offset };
    }

    let list = Array.from(memStore.courts.values()).map((c) => {
      const state = Array.from(memStore.states.values()).find((s) => s.id === c.state_id);
      const district = c.district_id ? memStore.districts.get(c.district_id) : null;
      const parent = c.parent_court_id
        ? Array.from(memStore.courts.values()).find((p) => p.id === c.parent_court_id)
        : null;
      return {
        ...c,
        state_name: state?.name || '',
        state_code: state?.code || '',
        district_name: district?.name || '',
        district_code: district?.code || '',
        parent_court_name: parent?.name || null,
      };
    });

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.state_name.toLowerCase().includes(q) ||
          c.district_name.toLowerCase().includes(q)
      );
    }
    if (stateCode) list = list.filter((c) => c.state_code === stateCode);
    if (districtCode) list = list.filter((c) => c.district_code === districtCode);
    if (type) list = list.filter((c) => c.type === type);
    if (status) list = list.filter((c) => c.status === status);

    const total = list.length;
    const isDesc = sortOrder.toUpperCase() === 'DESC';

    list.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (typeof valA === 'string') {
        return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return isDesc ? valB - valA : valA - valB;
    });

    const paginated = list.slice(offset, offset + limit);
    return { courts: paginated, total, limit, offset };
  },

  async getCourtHierarchy() {
    const states = await this.getStates();
    const result = [];

    for (const state of states) {
      let districts = [];
      let stateCourts = [];

      if (isDbConnected) {
        const dRes = await query('SELECT * FROM districts WHERE state_id = $1 ORDER BY name ASC', [state.id]);
        districts = dRes.rows;
        const cRes = await query('SELECT * FROM courts WHERE state_id = $1 ORDER BY name ASC', [state.id]);
        stateCourts = cRes.rows;
      } else {
        districts = Array.from(memStore.districts.values()).filter((d) => d.state_id === state.id);
        stateCourts = Array.from(memStore.courts.values()).filter((c) => c.state_id === state.id);
      }

      const highCourts = stateCourts.filter((c) => c.type === 'HIGH_COURT' || !c.district_id);
      const districtNodes = districts.map((dist) => {
        const courtsInDistrict = stateCourts.filter((c) => c.district_id === dist.id);
        return {
          id: dist.id,
          name: dist.name,
          code: dist.code,
          type: 'DISTRICT',
          courts: courtsInDistrict,
          courtCount: courtsInDistrict.length,
        };
      });

      result.push({
        id: state.id,
        name: state.name,
        code: state.code,
        highCourts,
        districts: districtNodes,
        totalCourts: stateCourts.length,
      });
    }

    return result;
  },

  // Dynamic Enums
  async upsertApiEnum({ category, code, label, metadata = {} }) {
    const id = uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        `INSERT INTO api_enums (id, category, code, label, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (category, code) DO UPDATE SET label = $4, metadata = $5, updated_at = $7
         RETURNING *`,
        [id, category, code, label, JSON.stringify(metadata), now, now]
      );
      return res.rows[0];
    }
    const key = `${category}:${code}`;
    const existing = memStore.apiEnums.get(key);
    if (existing) {
      existing.label = label;
      existing.metadata = metadata;
      existing.updated_at = now;
      return existing;
    }
    const record = { id, category, code, label, metadata, created_at: now, updated_at: now };
    memStore.apiEnums.set(key, record);
    return record;
  },

  async getApiEnums(category = null) {
    if (isDbConnected) {
      const sql = category
        ? 'SELECT * FROM api_enums WHERE category = $1 ORDER BY label ASC'
        : 'SELECT * FROM api_enums ORDER BY category ASC, label ASC';
      const params = category ? [category] : [];
      const res = await query(sql, params);
      return res.rows;
    }
    let list = Array.from(memStore.apiEnums.values());
    if (category) {
      list = list.filter((e) => e.category === category);
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  },

  // API Request Logs
  async createApiRequestLog({ endpoint, method, requestIdentifier, caseCnr = null, courtCode = null, statusCode, success, responseTimeMs, estimatedCost = 0, errorMessage = null }) {
    const id = uuidv4();
    const now = new Date();
    if (isDbConnected) {
      const res = await query(
        `INSERT INTO api_request_logs (id, endpoint, method, request_identifier, case_cnr, court_code, status_code, success, response_time_ms, estimated_cost, error_message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [id, endpoint, method, requestIdentifier, caseCnr, courtCode, statusCode, success, responseTimeMs, estimatedCost, errorMessage, now]
      );
      return res.rows[0];
    }

    const record = {
      id,
      endpoint,
      method,
      request_identifier: requestIdentifier,
      case_cnr: caseCnr,
      court_code: courtCode,
      status_code: statusCode,
      success,
      response_time_ms: responseTimeMs,
      estimated_cost: estimatedCost,
      error_message: errorMessage,
      created_at: now,
    };
    memStore.apiRequestLogs.unshift(record);
    if (memStore.apiRequestLogs.length > 500) memStore.apiRequestLogs.pop();
    return record;
  },

  async getApiRequestLogs({ limit = 50, offset = 0, courtCode = null, caseCnr = null } = {}) {
    if (isDbConnected) {
      let where = [];
      let params = [];
      let idx = 1;
      if (courtCode) {
        where.push(`court_code = $${idx}`);
        params.push(courtCode);
        idx++;
      }
      if (caseCnr) {
        where.push(`case_cnr = $${idx}`);
        params.push(caseCnr);
        idx++;
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const res = await query(
        `SELECT * FROM api_request_logs ${whereSql} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );
      return res.rows;
    }

    let logs = [...memStore.apiRequestLogs];
    if (courtCode) logs = logs.filter((l) => l.court_code === courtCode);
    if (caseCnr) logs = logs.filter((l) => l.case_cnr === caseCnr);
    return logs.slice(offset, offset + limit);
  },

  // Case Registry
  async registerDiscoveredCnr({ cnr, courtId, caseStatus = 'PENDING', syncStatus = 'PENDING_DETAIL', priorityScore = 100, metadata = {} }) {
    const normalizedCnr = cnr.toUpperCase().trim();
    const id = uuidv4();
    const now = new Date();

    if (isDbConnected) {
      const existingRes = await query('SELECT * FROM case_registry WHERE cnr = $1', [normalizedCnr]);
      if (existingRes.rows[0]) {
        const updateRes = await query(
          'UPDATE case_registry SET last_discovered_at = $1, updated_at = $1 WHERE cnr = $2 RETURNING *',
          [now, normalizedCnr]
        );
        return { isNew: false, record: updateRes.rows[0] };
      }

      const insertRes = await query(
        `INSERT INTO case_registry (id, cnr, court_id, first_discovered_at, last_discovered_at, case_status, sync_status, priority_score, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [id, normalizedCnr, courtId, now, now, caseStatus, syncStatus, priorityScore, JSON.stringify(metadata), now, now]
      );

      await query('UPDATE courts SET total_cases = total_cases + 1, updated_at = $1 WHERE id = $2', [now, courtId]);
      return { isNew: true, record: insertRes.rows[0] };
    }

    const existing = memStore.caseRegistry.get(normalizedCnr);
    if (existing) {
      existing.last_discovered_at = now;
      existing.updated_at = now;
      return { isNew: false, record: { ...existing } };
    }

    const newRecord = {
      id,
      cnr: normalizedCnr,
      court_id: courtId,
      first_discovered_at: now,
      last_discovered_at: now,
      last_detail_sync_at: null,
      last_refresh_at: null,
      case_status: caseStatus,
      sync_status: syncStatus,
      priority_score: priorityScore,
      metadata,
      created_at: now,
      updated_at: now,
    };
    memStore.caseRegistry.set(normalizedCnr, newRecord);

    const court = Array.from(memStore.courts.values()).find((c) => c.id === courtId);
    if (court) {
      court.total_cases = (court.total_cases || 0) + 1;
      court.updated_at = now;
    }

    return { isNew: true, record: { ...newRecord } };
  },

  async updateCaseRegistrySyncStatus(cnr, syncStatus) {
    const normalizedCnr = cnr.toUpperCase().trim();
    const now = new Date();

    if (isDbConnected) {
      await query(
        'UPDATE case_registry SET sync_status = $1, last_detail_sync_at = $2, updated_at = $2 WHERE cnr = $3',
        [syncStatus, now, normalizedCnr]
      );
      return;
    }

    const record = memStore.caseRegistry.get(normalizedCnr);
    if (record) {
      record.sync_status = syncStatus;
      record.last_detail_sync_at = now;
      record.updated_at = now;
    }
  },

  async getRegisteredCases({ search = '', courtId = '', stateCode = '', syncStatus = '', caseStatus = '', limit = 20, offset = 0, sortBy = 'last_discovered_at', sortOrder = 'DESC' } = {}) {
    if (isDbConnected) {
      let where = [];
      let params = [];
      let idx = 1;

      if (search) {
        where.push(`(cr.cnr ILIKE $${idx} OR c.name ILIKE $${idx} OR c.code ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }
      if (courtId) {
        where.push(`cr.court_id = $${idx}`);
        params.push(courtId);
        idx++;
      }
      if (stateCode) {
        where.push(`s.code = $${idx}`);
        params.push(stateCode);
        idx++;
      }
      if (syncStatus) {
        where.push(`cr.sync_status = $${idx}`);
        params.push(syncStatus);
        idx++;
      }
      if (caseStatus) {
        where.push(`cr.case_status = $${idx}`);
        params.push(caseStatus);
        idx++;
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const orderCol = ['cnr', 'first_discovered_at', 'last_discovered_at', 'priority_score'].includes(sortBy) ? `cr.${sortBy}` : 'cr.last_discovered_at';
      const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const countRes = await query(
        `SELECT COUNT(*) as total FROM case_registry cr
         LEFT JOIN courts c ON c.id = cr.court_id
         LEFT JOIN states s ON s.id = c.state_id
         ${whereSql}`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await query(
        `SELECT cr.*, c.name as court_name, c.code as court_code, c.type as court_type,
                s.name as state_name, s.code as state_code
         FROM case_registry cr
         LEFT JOIN courts c ON c.id = cr.court_id
         LEFT JOIN states s ON s.id = c.state_id
         ${whereSql}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      return { cases: dataRes.rows, total, limit, offset };
    }

    let list = Array.from(memStore.caseRegistry.values()).map((cr) => {
      const court = Array.from(memStore.courts.values()).find((c) => c.id === cr.court_id);
      const state = court ? Array.from(memStore.states.values()).find((s) => s.id === court.state_id) : null;
      return {
        ...cr,
        court_name: court?.name || '',
        court_code: court?.code || '',
        court_type: court?.type || '',
        state_name: state?.name || '',
        state_code: state?.code || '',
      };
    });

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.cnr.toLowerCase().includes(q) || c.court_name.toLowerCase().includes(q) || c.court_code.toLowerCase().includes(q));
    }
    if (courtId) list = list.filter((c) => c.court_id === courtId);
    if (stateCode) list = list.filter((c) => c.state_code === stateCode);
    if (syncStatus) list = list.filter((c) => c.sync_status === syncStatus);
    if (caseStatus) list = list.filter((c) => c.case_status === caseStatus);

    const total = list.length;
    const isDesc = sortOrder.toUpperCase() === 'DESC';

    list.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (typeof valA === 'string') {
        return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return isDesc ? valB - valA : valA - valB;
    });

    return { cases: list.slice(offset, offset + limit), total, limit, offset };
  },

  async getRegistryStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isDbConnected) {
      const totalRes = await query('SELECT COUNT(*) as total FROM case_registry');
      const todayRes = await query('SELECT COUNT(*) as today_count FROM case_registry WHERE first_discovered_at >= $1', [today]);
      const pendingRes = await query("SELECT COUNT(*) as pending FROM case_registry WHERE sync_status = 'PENDING_DETAIL'");
      const activeJobsRes = await query("SELECT COUNT(*) as active_jobs FROM discovery_jobs WHERE status IN ('QUEUED', 'RUNNING')");

      return {
        totalDiscovered: parseInt(totalRes.rows[0]?.total || '0', 10),
        newToday: parseInt(todayRes.rows[0]?.today_count || '0', 10),
        pendingDetailSync: parseInt(pendingRes.rows[0]?.pending || '0', 10),
        activeDiscoveryJobs: parseInt(activeJobsRes.rows[0]?.active_jobs || '0', 10),
      };
    }

    const all = Array.from(memStore.caseRegistry.values());
    const totalDiscovered = all.length;
    const newToday = all.filter((c) => new Date(c.first_discovered_at) >= today).length;
    const pendingDetailSync = all.filter((c) => c.sync_status === 'PENDING_DETAIL').length;
    const activeJobs = Array.from(memStore.discoveryJobs.values()).filter((j) => ['QUEUED', 'RUNNING'].includes(j.status)).length;

    return {
      totalDiscovered,
      newToday,
      pendingDetailSync,
      activeDiscoveryJobs: activeJobs,
    };
  },

  // Discovery Jobs
  async createDiscoveryJob({ campaignId = null, dailyRunId = null, courtId, strategy, filters = {}, createdBy = null, totalPages = 1 }) {
    const id = uuidv4();
    const now = new Date();

    if (isDbConnected) {
      const res = await query(
        `INSERT INTO discovery_jobs (id, campaign_id, daily_run_id, court_id, strategy, filters, status, current_page, total_pages, records_found, new_cases_found, existing_cases_found, processed_records, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING *`,
        [id, campaignId, dailyRunId, courtId, strategy, JSON.stringify(filters), 'QUEUED', 1, totalPages, 0, 0, 0, 0, createdBy, now, now]
      );
      return res.rows[0];
    }

    const job = {
      id,
      campaign_id: campaignId,
      daily_run_id: dailyRunId,
      court_id: courtId,
      strategy,
      filters,
      status: 'QUEUED',
      current_page: 1,
      total_pages: totalPages,
      records_found: 0,
      new_cases_found: 0,
      existing_cases_found: 0,
      processed_records: 0,
      started_at: null,
      completed_at: null,
      error_message: null,
      retry_count: 0,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };
    memStore.discoveryJobs.set(id, job);
    return { ...job };
  },

  async findDiscoveryJobById(id) {
    if (isDbConnected) {
      const res = await query(
        `SELECT dj.*, c.name as court_name, c.code as court_code, c.type as court_type,
                s.name as state_name, s.code as state_code
         FROM discovery_jobs dj
         LEFT JOIN courts c ON c.id = dj.court_id
         LEFT JOIN states s ON s.id = c.state_id
         WHERE dj.id = $1`,
        [id]
      );
      return res.rows[0] || null;
    }

    const job = memStore.discoveryJobs.get(id);
    if (!job) return null;
    const court = Array.from(memStore.courts.values()).find((c) => c.id === job.court_id);
    const state = court ? Array.from(memStore.states.values()).find((s) => s.id === court.state_id) : null;
    return {
      ...job,
      court_name: court?.name || '',
      court_code: court?.code || '',
      court_type: court?.type || '',
      state_name: state?.name || '',
      state_code: state?.code || '',
    };
  },

  async updateDiscoveryJob(id, updates) {
    const now = new Date();

    if (isDbConnected) {
      const fields = [];
      const params = [now, id];
      let idx = 3;

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'filters') {
          fields.push(`filters = $${idx}`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${idx}`);
          params.push(value);
        }
        idx++;
      }

      const res = await query(
        `UPDATE discovery_jobs SET updated_at = $1, ${fields.join(', ')} WHERE id = $2 RETURNING *`,
        params
      );
      return res.rows[0] || null;
    }

    const job = memStore.discoveryJobs.get(id);
    if (!job) return null;
    Object.assign(job, updates, { updated_at: now });
    return { ...job };
  },

  async getDiscoveryJobs({ campaignId = null, dailyRunId = null, courtId = null, status = null, strategy = null, limit = 20, offset = 0 } = {}) {
    if (isDbConnected) {
      let where = [];
      let params = [];
      let idx = 1;

      if (campaignId) {
        where.push(`dj.campaign_id = $${idx}`);
        params.push(campaignId);
        idx++;
      }
      if (dailyRunId) {
        where.push(`dj.daily_run_id = $${idx}`);
        params.push(dailyRunId);
        idx++;
      }
      if (courtId) {
        where.push(`dj.court_id = $${idx}`);
        params.push(courtId);
        idx++;
      }
      if (status) {
        where.push(`dj.status = $${idx}`);
        params.push(status);
        idx++;
      }
      if (strategy) {
        where.push(`dj.strategy = $${idx}`);
        params.push(strategy);
        idx++;
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const countRes = await query(`SELECT COUNT(*) as total FROM discovery_jobs dj ${whereSql}`, params);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await query(
        `SELECT dj.*, c.name as court_name, c.code as court_code, c.type as court_type,
                s.name as state_name, s.code as state_code
         FROM discovery_jobs dj
         LEFT JOIN courts c ON c.id = dj.court_id
         LEFT JOIN states s ON s.id = c.state_id
         ${whereSql}
         ORDER BY dj.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      return { jobs: dataRes.rows, total, limit, offset };
    }

    let list = Array.from(memStore.discoveryJobs.values()).map((dj) => {
      const court = Array.from(memStore.courts.values()).find((c) => c.id === dj.court_id);
      const state = court ? Array.from(memStore.states.values()).find((s) => s.id === court.state_id) : null;
      return {
        ...dj,
        court_name: court?.name || '',
        court_code: court?.code || '',
        court_type: court?.type || '',
        state_name: state?.name || '',
        state_code: state?.code || '',
      };
    });

    if (campaignId) list = list.filter((j) => j.campaign_id === campaignId);
    if (dailyRunId) list = list.filter((j) => j.daily_run_id === dailyRunId);
    if (courtId) list = list.filter((j) => j.court_id === courtId);
    if (status) list = list.filter((j) => j.status === status);
    if (strategy) list = list.filter((j) => j.strategy === strategy);

    const total = list.length;
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { jobs: list.slice(offset, offset + limit), total, limit, offset };
  },

  // Raw API Archiving & Case Details
  async archiveRawApiResponse({ source = 'ECOURTS_INDIA', endpoint, caseCnr, rawPayload, storagePath = null }) {
    const id = uuidv4();
    const now = new Date();
    const payloadStr = JSON.stringify(rawPayload);
    const responseHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

    if (isDbConnected) {
      const res = await query(
        `INSERT INTO raw_api_responses (id, source, endpoint, case_cnr, storage_path, raw_payload, response_hash, parser_version, retrieved_at, processing_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [id, source, endpoint, caseCnr, storagePath || `s3://ecourts-raw/${caseCnr}/${Date.now()}.json`, payloadStr, responseHash, 'v1.0', now, 'PROCESSED']
      );
      return res.rows[0];
    }

    const record = {
      id,
      source,
      endpoint,
      case_cnr: caseCnr,
      storage_path: storagePath || `s3://ecourts-raw/${caseCnr}/${Date.now()}.json`,
      raw_payload: rawPayload,
      response_hash: responseHash,
      parser_version: 'v1.0',
      retrieved_at: now,
      processing_status: 'PROCESSED',
    };
    memStore.rawApiResponses.set(id, record);
    return record;
  },

  async getRawApiResponseByCnr(cnr) {
    const normalizedCnr = cnr.toUpperCase().trim();
    if (isDbConnected) {
      const res = await query('SELECT * FROM raw_api_responses WHERE case_cnr = $1 ORDER BY retrieved_at DESC LIMIT 1', [normalizedCnr]);
      return res.rows[0] || null;
    }
    const list = Array.from(memStore.rawApiResponses.values()).filter((r) => r.case_cnr === normalizedCnr);
    return list[0] || null;
  },

  async saveCaseDetailTransaction({ caseData, parties = [], advocates = [], judges = [], hearings = [], orders = [], judgments = [], rawResponseId = null }) {
    const now = new Date();
    const normalizedCnr = caseData.cnr.toUpperCase().trim();

    if (isDbConnected) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const caseId = uuidv4();
        const caseRes = await client.query(
          `INSERT INTO cases (id, cnr, court_id, case_number, case_type, filing_number, filing_date, registration_number, registration_date, first_hearing_date, next_hearing_date, decision_date, case_status, nature_of_disposal, sub_category, under_acts, under_sections, police_station, fir_number, fir_year, title, raw_response_id, metadata, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
           ON CONFLICT (cnr) DO UPDATE SET
             court_id = $3,
             case_number = $4,
             case_type = $5,
             filing_number = $6,
             filing_date = $7,
             registration_number = $8,
             registration_date = $9,
             first_hearing_date = $10,
             next_hearing_date = $11,
             decision_date = $12,
             case_status = $13,
             nature_of_disposal = $14,
             sub_category = $15,
             under_acts = $16,
             under_sections = $17,
             police_station = $18,
             fir_number = $19,
             fir_year = $20,
             title = $21,
             raw_response_id = $22,
             metadata = $23,
             updated_at = $25
           RETURNING id`,
          [
            caseId,
            normalizedCnr,
            caseData.courtId,
            caseData.caseNumber,
            caseData.caseType,
            caseData.filingNumber,
            caseData.filingDate,
            caseData.registrationNumber,
            caseData.registrationDate,
            caseData.firstHearingDate,
            caseData.nextHearingDate,
            caseData.decisionDate,
            caseData.caseStatus,
            caseData.natureOfDisposal,
            caseData.subCategory,
            caseData.underActs,
            caseData.underSections,
            caseData.policeStation,
            caseData.firNumber,
            caseData.firYear,
            caseData.title,
            rawResponseId,
            JSON.stringify(caseData.metadata || {}),
            now,
            now,
          ]
        );

        const savedCaseId = caseRes.rows[0].id;

        await client.query('DELETE FROM case_parties WHERE case_id = $1', [savedCaseId]);
        await client.query('DELETE FROM case_advocates WHERE case_id = $1', [savedCaseId]);
        await client.query('DELETE FROM case_judges WHERE case_id = $1', [savedCaseId]);
        await client.query('DELETE FROM case_hearings WHERE case_id = $1', [savedCaseId]);
        await client.query('DELETE FROM case_orders WHERE case_id = $1', [savedCaseId]);
        await client.query('DELETE FROM case_judgments WHERE case_id = $1', [savedCaseId]);

        for (const p of parties) {
          await client.query(
            `INSERT INTO case_parties (id, case_id, party_type, party_number, name, gender, age, address, extra_details, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [uuidv4(), savedCaseId, p.partyType, p.partyNumber, p.name, p.gender, p.age, p.address, JSON.stringify(p.extraDetails || {}), now]
          );
        }

        for (const a of advocates) {
          const advId = uuidv4();
          const advRes = await client.query(
            `INSERT INTO advocates (id, name, bar_registration_number, phone, email, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (bar_registration_number) DO UPDATE SET name = $2, phone = $4, email = $5, updated_at = $7
             RETURNING id`,
            [advId, a.name, a.barRegistrationNumber, a.phone, a.email, now, now]
          );
          const savedAdvId = advRes.rows[0]?.id || advId;
          await client.query(
            `INSERT INTO case_advocates (id, case_id, advocate_id, party_type, is_lead, created_at)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
            [uuidv4(), savedCaseId, savedAdvId, a.partyType, a.isLead, now]
          );
        }

        for (const j of judges) {
          const judgeId = uuidv4();
          const judgeRes = await client.query(
            `INSERT INTO judges (id, name, designation, court_id, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [judgeId, j.name, j.designation, j.courtId, now, now]
          );
          const savedJudgeId = judgeRes.rows[0]?.id || judgeId;
          await client.query(
            `INSERT INTO case_judges (id, case_id, judge_id, role, created_at)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [uuidv4(), savedCaseId, savedJudgeId, j.role, now]
          );
        }

        for (const h of hearings) {
          await client.query(
            `INSERT INTO case_hearings (id, case_id, hearing_date, business_purpose, court_hall_number, judge_name, next_hearing_date, next_purpose, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [uuidv4(), savedCaseId, h.hearingDate, h.businessPurpose, h.courtHallNumber, h.judgeName, h.nextHearingDate, h.nextPurpose, now]
          );
        }

        for (const o of orders) {
          await client.query(
            `INSERT INTO case_orders (id, case_id, order_number, order_date, order_type, judge_name, document_url, storage_path, file_size_bytes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [uuidv4(), savedCaseId, o.orderNumber, o.orderDate, o.orderType, o.judgeName, o.documentUrl, o.storagePath, o.fileSizeBytes, now]
          );
        }

        for (const j of judgments) {
          await client.query(
            `INSERT INTO case_judgments (id, case_id, judgment_date, judgment_type, author_judge, document_url, storage_path, file_size_bytes, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [uuidv4(), savedCaseId, j.judgmentDate, j.judgmentType, j.authorJudge, j.documentUrl, j.storagePath, j.fileSizeBytes, now]
          );
        }

        await client.query(
          `UPDATE case_registry SET sync_status = 'SYNCED', last_detail_sync_at = $1, case_status = $2, updated_at = $1 WHERE cnr = $3`,
          [now, caseData.caseStatus, normalizedCnr]
        );

        await client.query('COMMIT');
        return { success: true, caseId: savedCaseId };
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const existingCase = memStore.cases.get(normalizedCnr);
    const caseId = existingCase?.id || uuidv4();

    const caseRecord = {
      id: caseId,
      cnr: normalizedCnr,
      court_id: caseData.courtId,
      case_number: caseData.caseNumber,
      case_type: caseData.caseType,
      filing_number: caseData.filingNumber,
      filing_date: caseData.filingDate,
      registration_number: caseData.registrationNumber,
      registration_date: caseData.registrationDate,
      first_hearing_date: caseData.firstHearingDate,
      next_hearing_date: caseData.nextHearingDate,
      decision_date: caseData.decisionDate,
      case_status: caseData.caseStatus,
      nature_of_disposal: caseData.natureOfDisposal,
      sub_category: caseData.subCategory,
      under_acts: caseData.underActs,
      under_sections: caseData.underSections,
      police_station: caseData.policeStation,
      fir_number: caseData.firNumber,
      fir_year: caseData.firYear,
      title: caseData.title,
      raw_response_id: rawResponseId,
      metadata: caseData.metadata || {},
      created_at: existingCase?.created_at || now,
      updated_at: now,
    };
    memStore.cases.set(normalizedCnr, caseRecord);

    for (const [k, p] of memStore.caseParties.entries()) {
      if (p.case_id === caseId) memStore.caseParties.delete(k);
    }
    parties.forEach((p) => {
      const pid = uuidv4();
      memStore.caseParties.set(pid, { id: pid, case_id: caseId, ...p, created_at: now });
    });

    for (const [k, ca] of memStore.caseAdvocates.entries()) {
      if (ca.case_id === caseId) memStore.caseAdvocates.delete(k);
    }
    advocates.forEach((a) => {
      let adv = Array.from(memStore.advocates.values()).find((ad) => ad.name === a.name);
      if (!adv) {
        adv = { id: uuidv4(), name: a.name, bar_registration_number: a.barRegistrationNumber, phone: a.phone, email: a.email, created_at: now, updated_at: now };
        memStore.advocates.set(adv.id, adv);
      }
      const caId = uuidv4();
      memStore.caseAdvocates.set(caId, { id: caId, case_id: caseId, advocate_id: adv.id, party_type: a.partyType, is_lead: a.isLead, name: a.name, bar_registration_number: a.barRegistrationNumber, created_at: now });
    });

    for (const [k, cj] of memStore.caseJudges.entries()) {
      if (cj.case_id === caseId) memStore.caseJudges.delete(k);
    }
    judges.forEach((j) => {
      let jg = Array.from(memStore.judges.values()).find((jd) => jd.name === j.name);
      if (!jg) {
        jg = { id: uuidv4(), name: j.name, designation: j.designation, court_id: j.courtId, created_at: now, updated_at: now };
        memStore.judges.set(jg.id, jg);
      }
      const cjId = uuidv4();
      memStore.caseJudges.set(cjId, { id: cjId, case_id: caseId, judge_id: jg.id, role: j.role, name: j.name, designation: j.designation, created_at: now });
    });

    for (const [k, h] of memStore.caseHearings.entries()) {
      if (h.case_id === caseId) memStore.caseHearings.delete(k);
    }
    hearings.forEach((h) => {
      const hid = uuidv4();
      memStore.caseHearings.set(hid, { id: hid, case_id: caseId, ...h, created_at: now });
    });

    for (const [k, o] of memStore.caseOrders.entries()) {
      if (o.case_id === caseId) memStore.caseOrders.delete(k);
    }
    orders.forEach((o) => {
      const oid = uuidv4();
      memStore.caseOrders.set(oid, { id: oid, case_id: caseId, ...o, created_at: now });
    });

    for (const [k, jm] of memStore.caseJudgments.entries()) {
      if (jm.case_id === caseId) memStore.caseJudgments.delete(k);
    }
    judgments.forEach((jm) => {
      const jid = uuidv4();
      memStore.caseJudgments.set(jid, { id: jid, case_id: caseId, ...jm, created_at: now });
    });

    const reg = memStore.caseRegistry.get(normalizedCnr);
    if (reg) {
      reg.sync_status = 'SYNCED';
      reg.last_detail_sync_at = now;
      reg.case_status = caseData.caseStatus;
      reg.updated_at = now;
    }

    return { success: true, caseId };
  },

  async getCaseByCnr(cnr) {
    const normalizedCnr = cnr.toUpperCase().trim();

    if (isDbConnected) {
      const caseRes = await query(
        `SELECT cs.*, c.name as court_name, c.code as court_code, c.type as court_type,
                s.name as state_name, s.code as state_code, d.name as district_name
         FROM cases cs
         LEFT JOIN courts c ON c.id = cs.court_id
         LEFT JOIN states s ON s.id = c.state_id
         LEFT JOIN districts d ON d.id = c.district_id
         WHERE cs.cnr = $1`,
        [normalizedCnr]
      );

      if (!caseRes.rows[0]) return null;
      const caseData = caseRes.rows[0];

      const partiesRes = await query('SELECT * FROM case_parties WHERE case_id = $1 ORDER BY party_number ASC', [caseData.id]);
      const advocatesRes = await query(
        `SELECT ca.*, a.name, a.bar_registration_number, a.phone, a.email
         FROM case_advocates ca
         JOIN advocates a ON a.id = ca.advocate_id
         WHERE ca.case_id = $1`,
        [caseData.id]
      );
      const judgesRes = await query(
        `SELECT cj.*, j.name, j.designation
         FROM case_judges cj
         JOIN judges j ON j.id = cj.judge_id
         WHERE cj.case_id = $1`,
        [caseData.id]
      );
      const hearingsRes = await query('SELECT * FROM case_hearings WHERE case_id = $1 ORDER BY hearing_date ASC', [caseData.id]);
      const ordersRes = await query('SELECT * FROM case_orders WHERE case_id = $1 ORDER BY order_date DESC', [caseData.id]);
      const judgmentsRes = await query('SELECT * FROM case_judgments WHERE case_id = $1 ORDER BY judgment_date DESC', [caseData.id]);

      return {
        ...caseData,
        parties: partiesRes.rows,
        advocates: advocatesRes.rows,
        judges: judgesRes.rows,
        hearings: hearingsRes.rows,
        orders: ordersRes.rows,
        judgments: judgmentsRes.rows,
      };
    }

    const c = memStore.cases.get(normalizedCnr);
    if (!c) return null;

    const court = Array.from(memStore.courts.values()).find((ct) => ct.id === c.court_id);
    const state = court ? Array.from(memStore.states.values()).find((s) => s.id === court.state_id) : null;
    const district = court?.district_id ? memStore.districts.get(court.district_id) : null;

    const parties = Array.from(memStore.caseParties.values()).filter((p) => p.case_id === c.id);
    const advocates = Array.from(memStore.caseAdvocates.values()).filter((ca) => ca.case_id === c.id);
    const judges = Array.from(memStore.caseJudges.values()).filter((cj) => cj.case_id === c.id);
    const hearings = Array.from(memStore.caseHearings.values()).filter((h) => h.case_id === c.id);
    const orders = Array.from(memStore.caseOrders.values()).filter((o) => o.case_id === c.id);
    const judgments = Array.from(memStore.caseJudgments.values()).filter((j) => j.case_id === c.id);

    return {
      ...c,
      court_name: court?.name || '',
      court_code: court?.code || '',
      court_type: court?.type || '',
      state_name: state?.name || '',
      state_code: state?.code || '',
      district_name: district?.name || '',
      parties,
      advocates,
      judges,
      hearings,
      orders,
      judgments,
    };
  },

  async getCases({ search = '', courtId = '', caseType = '', status = '', filingYear = '', limit = 20, offset = 0, sortBy = 'filing_date', sortOrder = 'DESC' } = {}) {
    if (isDbConnected) {
      let where = [];
      let params = [];
      let idx = 1;

      if (search) {
        where.push(`(cs.cnr ILIKE $${idx} OR cs.case_number ILIKE $${idx} OR cs.title ILIKE $${idx} OR c.name ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }
      if (courtId) {
        where.push(`cs.court_id = $${idx}`);
        params.push(courtId);
        idx++;
      }
      if (caseType) {
        where.push(`cs.case_type = $${idx}`);
        params.push(caseType);
        idx++;
      }
      if (status) {
        where.push(`cs.case_status = $${idx}`);
        params.push(status);
        idx++;
      }
      if (filingYear) {
        where.push(`(EXTRACT(YEAR FROM cs.filing_date) = $${idx} OR cs.cnr LIKE '%' || $${idx}::text)`);
        params.push(parseInt(filingYear, 10));
        idx++;
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const orderCol = ['filing_date', 'registration_date', 'next_hearing_date', 'cnr', 'created_at'].includes(sortBy) ? `cs.${sortBy}` : 'cs.filing_date';
      const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const countRes = await query(
        `SELECT COUNT(*) as total FROM cases cs
         LEFT JOIN courts c ON c.id = cs.court_id
         ${whereSql}`,
        params
      );
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await query(
        `SELECT cs.*, c.name as court_name, c.code as court_code, c.type as court_type,
                s.name as state_name, s.code as state_code
         FROM cases cs
         LEFT JOIN courts c ON c.id = cs.court_id
         LEFT JOIN states s ON s.id = c.state_id
         ${whereSql}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      return { cases: dataRes.rows, total, limit, offset };
    }

    let list = Array.from(memStore.cases.values()).map((cs) => {
      const court = Array.from(memStore.courts.values()).find((ct) => ct.id === cs.court_id);
      const state = court ? Array.from(memStore.states.values()).find((s) => s.id === court.state_id) : null;
      return {
        ...cs,
        court_name: court?.name || '',
        court_code: court?.code || '',
        court_type: court?.type || '',
        state_name: state?.name || '',
        state_code: state?.code || '',
      };
    });

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.cnr.toLowerCase().includes(q) || (c.case_number && c.case_number.toLowerCase().includes(q)) || (c.title && c.title.toLowerCase().includes(q)) || c.court_name.toLowerCase().includes(q));
    }
    if (courtId) list = list.filter((c) => c.court_id === courtId);
    if (caseType) list = list.filter((c) => c.case_type === caseType);
    if (status) list = list.filter((c) => c.case_status === status);
    if (filingYear) list = list.filter((c) => (c.filing_date && String(c.filing_date).startsWith(filingYear)) || (c.cnr && String(c.cnr).endsWith(filingYear)));

    const total = list.length;
    const isDesc = sortOrder.toUpperCase() === 'DESC';

    list.sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (typeof valA === 'string') {
        return isDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
      }
      return isDesc ? valB - valA : valA - valB;
    });

    return { cases: list.slice(offset, offset + limit), total, limit, offset };
  },

  // Backfill Campaigns (M5)
  async createBackfillCampaign({ name, selectedCourts, startDate, endDate, caseTypes = [], statuses = [], totalJobs = 0, createdBy = null, metadata = {} }) {
    const id = uuidv4();
    const now = new Date();

    if (isDbConnected) {
      const res = await query(
        `INSERT INTO backfill_campaigns (id, name, selected_courts, start_date, end_date, case_types, statuses, status, total_jobs, completed_jobs, failed_jobs, total_cnrs_discovered, total_details_synced, created_by, started_at, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          id,
          name,
          JSON.stringify(selectedCourts),
          startDate,
          endDate,
          JSON.stringify(caseTypes),
          JSON.stringify(statuses),
          'RUNNING',
          totalJobs,
          0,
          0,
          0,
          0,
          createdBy,
          now,
          JSON.stringify(metadata),
          now,
          now,
        ]
      );
      return res.rows[0];
    }

    const campaign = {
      id,
      name,
      selected_courts: selectedCourts,
      start_date: startDate,
      end_date: endDate,
      case_types: caseTypes,
      statuses,
      status: 'RUNNING',
      total_jobs: totalJobs,
      completed_jobs: 0,
      failed_jobs: 0,
      total_cnrs_discovered: 0,
      total_details_synced: 0,
      created_by: createdBy,
      started_at: now,
      completed_at: null,
      metadata,
      created_at: now,
      updated_at: now,
    };
    memStore.backfillCampaigns.set(id, campaign);
    return { ...campaign };
  },

  async findBackfillCampaignById(id) {
    if (isDbConnected) {
      const campRes = await query('SELECT * FROM backfill_campaigns WHERE id = $1', [id]);
      if (!campRes.rows[0]) return null;
      const campaign = campRes.rows[0];

      const jobsRes = await query(
        `SELECT dj.*, c.name as court_name, c.code as court_code 
         FROM discovery_jobs dj 
         LEFT JOIN courts c ON c.id = dj.court_id 
         WHERE dj.campaign_id = $1 
         ORDER BY dj.created_at ASC`,
        [id]
      );
      campaign.segments = jobsRes.rows;
      return campaign;
    }

    const campaign = memStore.backfillCampaigns.get(id);
    if (!campaign) return null;

    const segments = Array.from(memStore.discoveryJobs.values()).filter((j) => j.campaign_id === id);
    return {
      ...campaign,
      segments,
    };
  },

  async updateBackfillCampaign(id, updates) {
    const now = new Date();

    if (isDbConnected) {
      const fields = [];
      const params = [now, id];
      let idx = 3;

      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
          fields.push(`${key} = $${idx}`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${idx}`);
          params.push(value);
        }
        idx++;
      }

      const res = await query(
        `UPDATE backfill_campaigns SET updated_at = $1, ${fields.join(', ')} WHERE id = $2 RETURNING *`,
        params
      );
      return res.rows[0] || null;
    }

    const campaign = memStore.backfillCampaigns.get(id);
    if (!campaign) return null;
    Object.assign(campaign, updates, { updated_at: now });
    return { ...campaign };
  },

  async updateCampaignProgress(campaignId) {
    if (!campaignId) return;

    if (isDbConnected) {
      const statsRes = await query(
        `SELECT 
           COUNT(*) as total_segments,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_segments,
           COUNT(*) FILTER (WHERE status = 'FAILED') as failed_segments,
           COALESCE(SUM(records_found), 0) as total_records,
           COALESCE(SUM(new_cases_found), 0) as new_cnrs
         FROM discovery_jobs WHERE campaign_id = $1`,
        [campaignId]
      );
      const stats = statsRes.rows[0];
      const completed = parseInt(stats.completed_segments || '0', 10);
      const failed = parseInt(stats.failed_segments || '0', 10);
      const total = parseInt(stats.total_segments || '0', 10);
      const newCnrs = parseInt(stats.new_cnrs || '0', 10);

      const isAllDone = total > 0 && completed + failed >= total;
      const finalStatus = isAllDone ? (failed > 0 && completed === 0 ? 'FAILED' : 'COMPLETED') : 'RUNNING';

      await query(
        `UPDATE backfill_campaigns SET 
           completed_jobs = $1,
           failed_jobs = $2,
           total_cnrs_discovered = $3,
           status = CASE WHEN status = 'PAUSED' THEN 'PAUSED' WHEN status = 'CANCELLED' THEN 'CANCELLED' ELSE $4 END,
           completed_at = CASE WHEN $5 = true THEN CURRENT_TIMESTAMP ELSE completed_at END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [completed, failed, newCnrs, finalStatus, isAllDone, campaignId]
      );
      return;
    }

    const campaign = memStore.backfillCampaigns.get(campaignId);
    if (!campaign) return;

    const segments = Array.from(memStore.discoveryJobs.values()).filter((j) => j.campaign_id === campaignId);
    const completed = segments.filter((s) => s.status === 'COMPLETED').length;
    const failed = segments.filter((s) => s.status === 'FAILED').length;
    const totalCnrs = segments.reduce((sum, s) => sum + (s.new_cases_found || 0), 0);

    campaign.completed_jobs = completed;
    campaign.failed_jobs = failed;
    campaign.total_cnrs_discovered = totalCnrs;

    if (segments.length > 0 && completed + failed >= segments.length) {
      if (campaign.status !== 'PAUSED' && campaign.status !== 'CANCELLED') {
        campaign.status = failed > 0 && completed === 0 ? 'FAILED' : 'COMPLETED';
        campaign.completed_at = new Date();
      }
    }
    campaign.updated_at = new Date();
  },

  async getBackfillCampaigns({ status = null, limit = 20, offset = 0 } = {}) {
    if (isDbConnected) {
      let where = [];
      let params = [];
      let idx = 1;

      if (status) {
        where.push(`bc.status = $${idx}`);
        params.push(status);
        idx++;
      }

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const countRes = await query(`SELECT COUNT(*) as total FROM backfill_campaigns bc ${whereSql}`, params);
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await query(
        `SELECT bc.* FROM backfill_campaigns bc
         ${whereSql}
         ORDER BY bc.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      return { campaigns: dataRes.rows, total, limit, offset };
    }

    let list = Array.from(memStore.backfillCampaigns.values());
    if (status) list = list.filter((c) => c.status === status);

    const total = list.length;
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { campaigns: list.slice(offset, offset + limit), total, limit, offset };
  },

  async getBackfillStats() {
    if (isDbConnected) {
      const statsRes = await query(
        `SELECT 
           COUNT(*) as total_campaigns,
           COUNT(*) FILTER (WHERE status = 'RUNNING') as active_campaigns,
           COALESCE(SUM(total_cnrs_discovered), 0) as total_cnrs,
           COALESCE(SUM(completed_jobs), 0) as completed_jobs,
           COALESCE(SUM(failed_jobs), 0) as failed_jobs
         FROM backfill_campaigns`
      );
      const s = statsRes.rows[0];
      return {
        totalCampaigns: parseInt(s.total_campaigns || '0', 10),
        activeCampaigns: parseInt(s.active_campaigns || '0', 10),
        totalCnrsDiscovered: parseInt(s.total_cnrs || '0', 10),
        completedJobs: parseInt(s.completed_jobs || '0', 10),
        failedJobs: parseInt(s.failed_jobs || '0', 10),
      };
    }

    const all = Array.from(memStore.backfillCampaigns.values());
    return {
      totalCampaigns: all.length,
      activeCampaigns: all.filter((c) => c.status === 'RUNNING').length,
      totalCnrsDiscovered: all.reduce((sum, c) => sum + (c.total_cnrs_discovered || 0), 0),
      completedJobs: all.reduce((sum, c) => sum + (c.completed_jobs || 0), 0),
      failedJobs: all.reduce((sum, c) => sum + (c.failed_jobs || 0), 0),
    };
  },

  // ==========================================
  // Milestone 6: Daily Discovery Runs
  // ==========================================

  async createDailyDiscoveryRun({ lookbackWindow, courtsScanned = 0, jobsCreated = 0, metadata = {} }) {
    const id = uuidv4();
    const now = new Date();

    if (isDbConnected) {
      const res = await query(
        `INSERT INTO daily_discovery_runs (id, lookback_window, status, courts_scanned, jobs_created, total_cases_found, new_cnrs_found, existing_cnrs_found, started_at, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [id, lookbackWindow, 'RUNNING', courtsScanned, jobsCreated, 0, 0, 0, now, JSON.stringify(metadata), now, now]
      );
      return res.rows[0];
    }

    const record = {
      id,
      lookback_window: lookbackWindow,
      status: 'RUNNING',
      courts_scanned: courtsScanned,
      jobs_created: jobsCreated,
      total_cases_found: 0,
      new_cnrs_found: 0,
      existing_cnrs_found: 0,
      started_at: now,
      completed_at: null,
      error_message: null,
      metadata,
      created_at: now,
      updated_at: now,
    };
    memStore.dailyDiscoveryRuns.set(id, record);
    return { ...record };
  },

  async updateDailyDiscoveryRun(id, updates) {
    const now = new Date();

    if (isDbConnected) {
      const fields = [];
      const params = [now, id];
      let idx = 3;

      for (const [key, value] of Object.entries(updates)) {
        if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
          fields.push(`${key} = $${idx}`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${idx}`);
          params.push(value);
        }
        idx++;
      }

      const res = await query(
        `UPDATE daily_discovery_runs SET updated_at = $1, ${fields.join(', ')} WHERE id = $2 RETURNING *`,
        params
      );
      return res.rows[0] || null;
    }

    const record = memStore.dailyDiscoveryRuns.get(id);
    if (!record) return null;
    Object.assign(record, updates, { updated_at: now });
    return { ...record };
  },

  async findDailyDiscoveryRunById(id) {
    if (isDbConnected) {
      const res = await query('SELECT * FROM daily_discovery_runs WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return memStore.dailyDiscoveryRuns.get(id) || null;
  },

  async getDailyDiscoveryRuns({ limit = 20, offset = 0 } = {}) {
    if (isDbConnected) {
      const countRes = await query('SELECT COUNT(*) as total FROM daily_discovery_runs');
      const total = parseInt(countRes.rows[0]?.total || '0', 10);

      const dataRes = await query(
        'SELECT * FROM daily_discovery_runs ORDER BY started_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return { runs: dataRes.rows, total, limit, offset };
    }

    const list = Array.from(memStore.dailyDiscoveryRuns.values());
    list.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    return { runs: list.slice(offset, offset + limit), total: list.length, limit, offset };
  },

  async getLastDailyDiscoveryRun() {
    if (isDbConnected) {
      const res = await query('SELECT * FROM daily_discovery_runs ORDER BY started_at DESC LIMIT 1');
      return res.rows[0] || null;
    }
    const list = Array.from(memStore.dailyDiscoveryRuns.values());
    if (!list.length) return null;
    list.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    return { ...list[0] };
  },

  async updateDailyRunProgress(dailyRunId) {
    if (!dailyRunId) return;

    if (isDbConnected) {
      const statsRes = await query(
        `SELECT 
           COUNT(*) as total_jobs,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed_jobs,
           COUNT(*) FILTER (WHERE status = 'FAILED') as failed_jobs,
           COALESCE(SUM(records_found), 0) as total_cases,
           COALESCE(SUM(new_cases_found), 0) as new_cnrs,
           COALESCE(SUM(existing_cases_found), 0) as existing_cnrs
         FROM discovery_jobs WHERE daily_run_id = $1`,
        [dailyRunId]
      );
      const s = statsRes.rows[0];
      const total = parseInt(s?.total_jobs || '0', 10);
      const completed = parseInt(s?.completed_jobs || '0', 10);
      const failed = parseInt(s?.failed_jobs || '0', 10);
      const totalCases = parseInt(s?.total_cases || '0', 10);
      const newCnrs = parseInt(s?.new_cnrs || '0', 10);
      const existingCnrs = parseInt(s?.existing_cnrs || '0', 10);

      const isAllDone = total > 0 && completed + failed >= total;
      const finalStatus = isAllDone ? (failed > 0 && completed === 0 ? 'FAILED' : 'COMPLETED') : 'RUNNING';

      await query(
        `UPDATE daily_discovery_runs SET 
           total_cases_found = $1,
           new_cnrs_found = $2,
           existing_cnrs_found = $3,
           status = $4,
           completed_at = CASE WHEN $5 = true THEN CURRENT_TIMESTAMP ELSE completed_at END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [totalCases, newCnrs, existingCnrs, finalStatus, isAllDone, dailyRunId]
      );
      return;
    }

    const run = memStore.dailyDiscoveryRuns.get(dailyRunId);
    if (!run) return;

    const jobs = Array.from(memStore.discoveryJobs.values()).filter((j) => j.daily_run_id === dailyRunId);
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
    const failed = jobs.filter((j) => j.status === 'FAILED').length;
    const totalCases = jobs.reduce((sum, j) => sum + (j.records_found || 0), 0);
    const newCnrs = jobs.reduce((sum, j) => sum + (j.new_cases_found || 0), 0);
    const existingCnrs = jobs.reduce((sum, j) => sum + (j.existing_cases_found || 0), 0);

    run.total_cases_found = totalCases;
    run.new_cnrs_found = newCnrs;
    run.existing_cnrs_found = existingCnrs;

    if (jobs.length > 0 && completed + failed >= jobs.length) {
      run.status = failed > 0 && completed === 0 ? 'FAILED' : 'COMPLETED';
      run.completed_at = new Date();
    }
    run.updated_at = new Date();
  },

  async clearOperationalData() {
    logger.warn('Purging all operational case, discovery, campaign, and log data...');
    if (isDbConnected) {
      try {
        await query(`
          TRUNCATE TABLE 
            case_hearings, 
            case_orders, 
            case_judgments, 
            case_advocates, 
            case_judges, 
            case_parties, 
            raw_api_responses, 
            cases, 
            case_registry, 
            discovery_jobs, 
            daily_discovery_runs, 
            backfill_campaigns, 
            api_request_logs 
          CASCADE;
        `);
      } catch (err) {
        logger.error('Error truncating PostgreSQL operational tables:', err);
      }
    }

    const counts = {
      cases: memStore.cases.size,
      caseRegistry: memStore.caseRegistry.size,
      discoveryJobs: memStore.discoveryJobs.size,
      backfillCampaigns: memStore.backfillCampaigns.size,
      dailyDiscoveryRuns: memStore.dailyDiscoveryRuns.size,
      apiRequestLogs: memStore.apiRequestLogs.length,
    };

    memStore.cases.clear();
    memStore.caseParties.clear();
    memStore.advocates.clear();
    memStore.caseAdvocates.clear();
    memStore.judges.clear();
    memStore.caseJudges.clear();
    memStore.caseHearings.clear();
    memStore.caseOrders.clear();
    memStore.caseJudgments.clear();
    memStore.rawApiResponses.clear();
    memStore.caseRegistry.clear();
    memStore.discoveryJobs.clear();
    memStore.dailyDiscoveryRuns.clear();
    memStore.backfillCampaigns.clear();
    memStore.apiRequestLogs = [];

    return counts;
  },
};


'use strict';

const API = '/api/organization';
const SESSION_KEY = 'portalKey';

// ============================================================================
// PORTAL CONTROLLER
// ============================================================================

const Portal = {
    activationKey: null,
    orgData: null,

    async init() {
        // Format activation key input as user types
        document.getElementById('activationKeyInput').addEventListener('input', (e) => {
            let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (v.length > 3)  v = v.slice(0,3)  + '-' + v.slice(3);
            if (v.length > 8)  v = v.slice(0,8)  + '-' + v.slice(8);
            if (v.length > 13) v = v.slice(0,13) + '-' + v.slice(13);
            e.target.value = v.slice(0, 19);
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Restore session
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
            this.activationKey = saved;
            await this.loadPortal();
        }
    },

    // ── LOGIN ──────────────────────────────────────────────────────────────
    async login() {
        const key = document.getElementById('activationKeyInput').value.trim().toUpperCase();
        const errEl = document.getElementById('loginError');
        errEl.classList.add('d-none');

        if (!key.match(/^DNS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)) {
            errEl.textContent = 'Please enter a valid activation key (DNS-XXXX-XXXX-XXXX)';
            errEl.classList.remove('d-none');
            return;
        }

        const btn = document.getElementById('loginBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verifying...';

        try {
            const res = await fetch(`${API}/portal/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activationKey: key })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                errEl.textContent = data.message || 'Invalid activation key. Please check and try again.';
                errEl.classList.remove('d-none');
                return;
            }

            this.activationKey = key;
            this.orgData = data.organization;
            sessionStorage.setItem(SESSION_KEY, key);
            await this.loadPortal();

        } catch {
            errEl.textContent = 'Unable to connect to the server. Please try again.';
            errEl.classList.remove('d-none');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt me-2"></i>Access My Portal';
        }
    },

    // ── LOAD FULL PORTAL ──────────────────────────────────────────────────
    async loadPortal() {
        this.showLoading(true);

        try {
            // If we restored from session, re-fetch org info
            if (!this.orgData) {
                const res = await fetch(`${API}/portal/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activationKey: this.activationKey })
                });
                const data = await res.json();
                if (!res.ok || !data.success) { this.logout(); return; }
                this.orgData = data.organization;
            }

            this.renderOrgInfo(this.orgData);

            // Fetch stats
            const statsRes = await fetch(`${API}/portal/stats/${encodeURIComponent(this.activationKey)}`);
            const statsData = await statsRes.json();

            if (statsRes.ok && statsData.success) {
                this.renderStats(statsData);
            }

            // Switch screens
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('portalScreen').style.display = 'block';

        } catch (err) {
            console.error('Portal load error:', err);
            this.logout();
        } finally {
            this.showLoading(false);
        }
    },

    // ── RENDER ORG INFO ───────────────────────────────────────────────────
    renderOrgInfo(org) {
        const name = org.organizationName || 'Your Company';
        const plan = org.planType || '';

        document.getElementById('navCompanyName').textContent  = name;
        document.getElementById('bannerCompanyName').textContent = name;
        document.title = `${name} — Customer Portal`;

        document.getElementById('navPlanBadge').textContent =
            plan ? plan.charAt(0).toUpperCase() + plan.slice(1) + ' Plan' : '';

        if (org.daysRemaining != null) {
            const days = org.daysRemaining;
            const cls  = days < 30 ? 'text-warning' : 'text-white-50';
            document.getElementById('navExpiry').className = `small ${cls}`;
            document.getElementById('navExpiry').textContent =
                days > 0 ? `${days} days remaining` : 'Subscription expired';
        }
    },

    // ── RENDER STATS ──────────────────────────────────────────────────────
    renderStats(data) {
        const { stats, clients, topThreats, topBlockedDomains, recentBlocked } = data;

        // Stat cards
        setText('statQueriesToday',  stats.queriesToday.toLocaleString());
        setText('statBlockedToday',  stats.blockedToday.toLocaleString());
        setText('statActiveClients', stats.activeClients.toLocaleString());
        setText('statBlocked30',     stats.blockedLast30Days.toLocaleString());
        setText('bannerActiveClients', `${stats.activeClients} / ${stats.maxClients}`);

        // License bar
        const pct = Math.min(100, Math.round((stats.totalClients / stats.maxClients) * 100));
        setText('licenseText', `${stats.totalClients} / ${stats.maxClients} clients used (${pct}%)`);
        const bar = document.getElementById('licenseBar');
        bar.style.width = pct + '%';
        bar.className = 'license-fill' + (pct >= 90 ? ' danger' : pct >= 75 ? ' warn' : '');

        // Clients table
        const tbody = document.getElementById('clientsTable');
        if (clients.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">
                <i class="fas fa-laptop fa-2x mb-2 d-block opacity-25"></i>
                No computers registered yet.<br>
                <small>Install the client software using your activation key.</small>
            </td></tr>`;
        } else {
            tbody.innerHTML = clients.map(c => {
                const online = new Date(c.lastSeen) > new Date(Date.now() - 24*60*60*1000);
                const lastSeen = new Date(c.lastSeen).toLocaleString();
                return `<tr class="client-row">
                    <td>
                        <span class="status-dot ${online ? 'online' : 'offline'}"></span>
                        <strong>${esc(c.computerName)}</strong>
                        ${c.location ? `<small class="text-muted ms-1">${esc(c.location)}</small>` : ''}
                    </td>
                    <td><code class="small">${esc(c.ipAddress)}</code></td>
                    <td><small class="text-muted">${lastSeen}</small></td>
                    <td class="text-end"><span class="badge bg-danger-subtle text-danger">${c.blockedQueries.toLocaleString()}</span></td>
                </tr>`;
            }).join('');
        }

        // Threat categories
        const threatEl = document.getElementById('threatList');
        if (!topThreats.length) {
            threatEl.innerHTML = '<p class="text-muted text-center small py-2">No threats blocked yet.</p>';
        } else {
            const max = topThreats[0].count;
            const fmtCat = s => s.replace(/([a-z])([A-Z])/g, '$1 $2'); // "AdultContent" → "Adult Content"
            threatEl.innerHTML = topThreats.map(t => `
                <div class="mb-2">
                    <div class="d-flex justify-content-between mb-1">
                        <small class="fw-bold">${esc(fmtCat(t.category))}</small>
                        <small class="text-muted">${t.count.toLocaleString()}</small>
                    </div>
                    <div class="progress" style="height:6px;">
                        <div class="progress-bar bg-warning" style="width:${Math.round((t.count/max)*100)}%"></div>
                    </div>
                </div>`).join('');
        }

        // Top blocked domains
        const domainEl = document.getElementById('domainList');
        if (!topBlockedDomains.length) {
            domainEl.innerHTML = '<p class="text-muted text-center small py-2">No blocked domains yet.</p>';
        } else {
            domainEl.innerHTML = topBlockedDomains.map((d, i) => `
                <div class="d-flex justify-content-between align-items-center py-1 border-bottom">
                    <span class="text-muted small me-2">${i+1}.</span>
                    <span class="small text-truncate flex-grow-1 font-monospace">${esc(d.domain)}</span>
                    <span class="threat-badge ms-2">${d.count.toLocaleString()}x</span>
                </div>`).join('');
        }

        // Recent blocks table
        const rbody = document.getElementById('recentBlocksTable');
        if (!recentBlocked.length) {
            rbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No blocked requests in the last 30 days.</td></tr>';
        } else {
            const fmtCat = s => s.replace(/([a-z])([A-Z])/g, '$1 $2');
            rbody.innerHTML = recentBlocked.map(r => `
                <tr>
                    <td><span class="font-monospace small text-danger">${esc(r.domain)}</span></td>
                    <td><small>${esc(r.computerName)}</small></td>
                    <td><span class="threat-badge">${esc(fmtCat(r.blockReason || 'Unknown'))}</span></td>
                    <td><small class="text-muted">${new Date(r.timestamp).toLocaleString()}</small></td>
                </tr>`).join('');
        }
    },

    // ── REFRESH ───────────────────────────────────────────────────────────
    async refresh() {
        if (!this.activationKey) return;
        this.showLoading(true);
        try {
            const res = await fetch(`${API}/portal/stats/${encodeURIComponent(this.activationKey)}`);
            const data = await res.json();
            if (res.ok && data.success) this.renderStats(data);
        } finally {
            this.showLoading(false);
        }
    },

    // ── LOGOUT ────────────────────────────────────────────────────────────
    logout() {
        sessionStorage.removeItem(SESSION_KEY);
        this.activationKey = null;
        this.orgData = null;
        document.getElementById('portalScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = '';
        document.getElementById('activationKeyInput').value = '';
        document.title = 'Customer Portal - HTRN85 DNS Security';
    },

    showLoading(show) {
        document.getElementById('loadingOverlay').classList.toggle('d-none', !show);
    }
};

// ── HELPERS ──────────────────────────────────────────────────────────────────

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

// ============================================================================
// DOMAIN LIST MANAGEMENT (Whitelist + Custom Blocklist)
// ============================================================================

const DomainLists = {

    // ── WHITELIST ─────────────────────────────────────────────────────────
    async loadWhitelist() {
        if (!Portal.activationKey) return;
        const tbody = document.getElementById('whitelistTable');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></td></tr>`;

        try {
            const res = await fetch(`${API}/portal/whitelist/${encodeURIComponent(Portal.activationKey)}`);
            const data = await res.json();
            if (!data.success) { tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center py-3">Failed to load</td></tr>`; return; }

            setText('whitelistCount', data.domains.length);

            if (!data.domains.length) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">
                    <i class="fas fa-check-circle fa-2x mb-2 d-block opacity-25 text-success"></i>
                    No whitelisted domains yet.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.domains.map(d => `
                <tr>
                    <td><span class="font-monospace small">${esc(d.domain)}</span></td>
                    <td><small class="text-muted">${esc(d.description || '—')}</small></td>
                    <td><small class="text-muted">${new Date(d.addedDate).toLocaleDateString()}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger py-0" onclick="DomainLists.removeWhitelist(${d.id}, '${esc(d.domain)}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>`).join('');
        } catch {
            tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center py-3">Connection error</td></tr>`;
        }
    },

    async addWhitelist() {
        const domain = document.getElementById('whitelistDomain').value.trim().toLowerCase();
        const desc   = document.getElementById('whitelistDesc').value.trim();
        const alertEl = document.getElementById('whitelistAddAlert');

        if (!domain) { showInlineAlert(alertEl, 'Please enter a domain.', 'warning'); return; }

        try {
            const res = await fetch(`${API}/portal/whitelist/${encodeURIComponent(Portal.activationKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, description: desc || null })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showInlineAlert(alertEl, `✓ ${domain} added to whitelist`, 'success');
                document.getElementById('whitelistDomain').value = '';
                document.getElementById('whitelistDesc').value = '';
                await this.loadWhitelist();
            } else {
                showInlineAlert(alertEl, data.message || 'Failed to add domain', 'danger');
            }
        } catch {
            showInlineAlert(alertEl, 'Connection error', 'danger');
        }
    },

    async removeWhitelist(id, domain) {
        if (!confirm(`Remove "${domain}" from whitelist?`)) return;
        await fetch(`${API}/portal/whitelist/${encodeURIComponent(Portal.activationKey)}/${id}`, { method: 'DELETE' });
        await this.loadWhitelist();
    },

    // ── CUSTOM BLOCKLIST ──────────────────────────────────────────────────
    async loadBlocklist() {
        if (!Portal.activationKey) return;
        const tbody = document.getElementById('blocklistTable');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></td></tr>`;

        try {
            const res = await fetch(`${API}/portal/blocklist/${encodeURIComponent(Portal.activationKey)}`);
            const data = await res.json();
            if (!data.success) { tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center py-3">Failed to load</td></tr>`; return; }

            setText('blocklistCount', data.domains.length);

            if (!data.domains.length) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">
                    <i class="fas fa-ban fa-2x mb-2 d-block opacity-25 text-danger"></i>
                    No custom blocked domains yet.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.domains.map(d => `
                <tr>
                    <td><span class="font-monospace small text-danger">${esc(d.domain)}</span></td>
                    <td><small class="text-muted">${esc(d.description || '—')}</small></td>
                    <td><small class="text-muted">${new Date(d.addedDate).toLocaleDateString()}</small></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger py-0" onclick="DomainLists.removeBlocklist(${d.id}, '${esc(d.domain)}')">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>`).join('');
        } catch {
            tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center py-3">Connection error</td></tr>`;
        }
    },

    async addBlocklist() {
        const domain  = document.getElementById('blocklistDomain').value.trim().toLowerCase();
        const desc    = document.getElementById('blocklistDesc').value.trim();
        const alertEl = document.getElementById('blocklistAddAlert');

        if (!domain) { showInlineAlert(alertEl, 'Please enter a domain.', 'warning'); return; }

        try {
            const res = await fetch(`${API}/portal/blocklist/${encodeURIComponent(Portal.activationKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, description: desc || null })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showInlineAlert(alertEl, `✓ ${domain} added to blocklist`, 'success');
                document.getElementById('blocklistDomain').value = '';
                document.getElementById('blocklistDesc').value = '';
                await this.loadBlocklist();
            } else {
                showInlineAlert(alertEl, data.message || 'Failed to add domain', 'danger');
            }
        } catch {
            showInlineAlert(alertEl, 'Connection error', 'danger');
        }
    },

    async removeBlocklist(id, domain) {
        if (!confirm(`Remove "${domain}" from custom blocklist?`)) return;
        await fetch(`${API}/portal/blocklist/${encodeURIComponent(Portal.activationKey)}/${id}`, { method: 'DELETE' });
        await this.loadBlocklist();
    }
};

function showInlineAlert(el, msg, type) {
    el.innerHTML = `<div class="alert alert-${type} alert-sm py-2 px-3 mb-3 small">${esc(msg)}</div>`;
    setTimeout(() => { el.innerHTML = ''; }, 4000);
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => Portal.init());

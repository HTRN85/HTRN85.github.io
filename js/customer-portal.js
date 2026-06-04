'use strict';

const API_BASE = 'https://yjbgqnugsw.us-east-1.awsapprunner.com';
const API = API_BASE + '/api/organization';
const SESSION_KEY = 'portalKey';

// ============================================================================
// PORTAL CONTROLLER
// ============================================================================

const Portal = {
    activationKey: null,
    orgData: null,
    _refreshTimer: null,
    _refreshInterval: 30000,   // 30 seconds

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
                this.setLastUpdated();
            }

            // Switch screens
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('portalScreen').style.display = 'block';

            this.startAutoRefresh();

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
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">
                <i class="fas fa-laptop fa-2x mb-2 d-block opacity-25"></i>
                No computers registered yet.<br>
                <small>Install the client software using your activation key.</small>
            </td></tr>`;
        } else {
            tbody.innerHTML = clients.map(c => {
                const online   = new Date(c.lastSeen) > new Date(Date.now() - 24*60*60*1000);
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
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger py-0"
                            title="Remove this computer from your organisation"
                            onclick="Portal.revokeClient(${c.id}, '${esc(c.computerName)}')">
                            <i class="fas fa-user-minus"></i>
                        </button>
                    </td>
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
    async refresh(manual = false) {
        if (!this.activationKey) return;

        // Spin the icon during manual refresh; silent for auto-refresh
        const icon = document.getElementById('refreshIcon');
        if (manual && icon) icon.classList.add('fa-spin');

        try {
            const res = await fetch(`${API}/portal/stats/${encodeURIComponent(this.activationKey)}`);
            const data = await res.json();
            if (res.ok && data.success) {
                this.renderStats(data);
                this.setLastUpdated();
            }
        } finally {
            if (manual && icon) icon.classList.remove('fa-spin');
        }
    },

    setLastUpdated() {
        const label = document.getElementById('lastUpdatedLabel');
        const time  = document.getElementById('lastUpdatedTime');
        if (label && time) {
            time.textContent = new Date().toLocaleTimeString();
            label.style.display = '';
        }
    },

    startAutoRefresh() {
        this.stopAutoRefresh();
        this._refreshTimer = setInterval(() => this.refresh(false), this._refreshInterval);
    },

    stopAutoRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    },

    // ── LOGOUT ────────────────────────────────────────────────────────────
    // ── REVOKE CLIENT ─────────────────────────────────────────────────────
    async revokeClient(clientId, computerName) {
        const confirmed = confirm(
            `Remove "${computerName}" from your organisation?\n\n` +
            `This computer will no longer count against your licence and your ` +
            `organisation's rules (whitelist / custom blocks) will not apply to it.\n\n` +
            `The computer can be re-added by running the installer with your activation key.`
        );
        if (!confirmed) return;

        try {
            const res  = await fetch(`${API}/portal/clients/${encodeURIComponent(this.activationKey)}/${clientId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                // Refresh stats immediately so the table updates
                await this.refresh(false);
            } else {
                alert(data.message || 'Failed to remove client.');
            }
        } catch {
            alert('Connection error. Please try again.');
        }
    },

    logout() {
        this.stopAutoRefresh();
        sessionStorage.removeItem(SESSION_KEY);
        this.activationKey = null;
        this.orgData = null;
        document.getElementById('portalScreen').style.display = 'none';
        document.getElementById('loginScreen').style.display = '';
        document.getElementById('activationKeyInput').value = '';
        document.title = 'Customer Portal - HTRN85 DNS Security';
        const label = document.getElementById('lastUpdatedLabel');
        if (label) label.style.display = 'none';
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

// ============================================================================
// GLOBAL THREAT BLOCKLIST BROWSER
// ============================================================================

const GlobalThreats = {
    _page: 1,
    _totalPages: 1,
    _searchTimer: null,

    // Category → badge colour
    _catColour: {
        Malware:          'danger',
        Phishing:         'warning',
        Ransomware:       'danger',
        CommandAndControl:'dark',
        Botnet:           'secondary',
        AdultContent:     'purple',
        SocialMedia:      'info',
        Gambling:         'success',
        Custom:           'primary'
    },

    async load(page = this._page) {
        if (!Portal.activationKey) return;
        this._page = page;

        const q        = (document.getElementById('threatSearch')?.value || '').trim();
        const category = document.getElementById('threatCategoryFilter')?.value || '';
        const tbody    = document.getElementById('threatTable');
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4">
            <span class="spinner-border spinner-border-sm me-2"></span>Loading...</td></tr>`;

        try {
            const params = new URLSearchParams({ page, pageSize: 50 });
            if (q)        params.set('q', q);
            if (category) params.set('category', category);

            const res  = await fetch(`${API}/portal/threats/${encodeURIComponent(Portal.activationKey)}?${params}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center py-3">Failed to load.</td></tr>`;
                return;
            }

            this._totalPages = data.totalPages;
            this._renderSummary(data.summary);
            this._renderTable(data.domains);
            this._renderPagination(data.page, data.totalPages, data.total);

        } catch {
            tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center py-3">Connection error.</td></tr>`;
        }
    },

    _renderSummary(summary) {
        const el = document.getElementById('threatSummaryBadges');
        const total = summary.reduce((s, c) => s + c.count, 0);
        setText('threatTotalLabel', `${total.toLocaleString()} total blocked domains`);

        const fmtCat = s => s.replace(/([a-z])([A-Z])/g, '$1 $2');
        el.innerHTML = summary
            .sort((a, b) => b.count - a.count)
            .map(c => {
                const col = this._catColour[c.category] || 'secondary';
                return `<span class="badge bg-${col} me-1 mb-1" style="cursor:pointer;"
                    onclick="document.getElementById('threatCategoryFilter').value='${esc(c.category)}';GlobalThreats.load(1)">
                    ${fmtCat(esc(c.category))}: ${c.count.toLocaleString()}
                </span>`;
            }).join('') +
            `<span class="badge bg-light text-dark border me-1 mb-1" style="cursor:pointer;"
                onclick="document.getElementById('threatCategoryFilter').value='';GlobalThreats.load(1)">
                All
            </span>`;
    },

    _renderTable(domains) {
        const tbody  = document.getElementById('threatTable');
        const fmtCat = s => s.replace(/([a-z])([A-Z])/g, '$1 $2');

        if (!domains.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No domains match your search.</td></tr>`;
            return;
        }

        tbody.innerHTML = domains.map(d => {
            const col    = this._catColour[d.category] || 'secondary';
            const remove = d.isCustom
                ? `<button class="btn btn-sm btn-outline-danger py-0 ms-2" title="Remove"
                       onclick="DomainLists.removeBlocklist(${d.id},'${esc(d.domain)}');setTimeout(()=>GlobalThreats.load(),600)">
                       <i class="fas fa-trash-alt"></i></button>`
                : '';
            return `<tr>
                <td class="font-monospace small">${esc(d.domain)}${remove}</td>
                <td><span class="badge bg-${col}">${fmtCat(esc(d.category))}</span></td>
                <td><small class="text-muted">${new Date(d.addedDate).toLocaleDateString()}</small></td>
                <td><small class="text-muted">${esc(d.description || '—')}</small></td>
            </tr>`;
        }).join('');
    },

    _renderPagination(page, totalPages, total) {
        const pag      = document.getElementById('threatPagination');
        const info     = document.getElementById('threatPageInfo');
        const prevBtn  = document.getElementById('threatPrevBtn');
        const nextBtn  = document.getElementById('threatNextBtn');

        pag.style.display = '';
        info.textContent  = `Page ${page} of ${totalPages}  (${total.toLocaleString()} domains)`;
        prevBtn.disabled  = page <= 1;
        nextBtn.disabled  = page >= totalPages;
    },

    prevPage() { if (this._page > 1)              this.load(this._page - 1); },
    nextPage() { if (this._page < this._totalPages) this.load(this._page + 1); },

    // Debounce search input so we don't fire on every keystroke
    onSearch(value) {
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.load(1), 350);
    }
};

// ============================================================================
// EMAIL REPORTS SETTINGS
// ============================================================================

const EmailReports = {
    _recipients: [],   // in-memory list, synced on load and save

    async load() {
        if (!Portal.activationKey) return;
        try {
            const res  = await fetch(`${API}/portal/email-settings/${encodeURIComponent(Portal.activationKey)}`);
            const data = await res.json();
            if (!res.ok || !data.success) return;

            document.getElementById('reportEnabled').checked   = data.isEnabled;
            document.getElementById('reportFrequency').value   = data.frequency  || 'Daily';
            document.getElementById('reportHour').value        = data.sendHourUtc ?? 7;

            this._recipients = data.recipients || [];
            this._renderRecipients();
        } catch (err) {
            console.error('Failed to load email settings:', err);
        }
    },

    async save() {
        if (!Portal.activationKey) return;
        const alertEl = document.getElementById('reportSettingsAlert');

        const payload = {
            isEnabled:   document.getElementById('reportEnabled').checked,
            frequency:   document.getElementById('reportFrequency').value,
            sendHourUtc: parseInt(document.getElementById('reportHour').value, 10),
            recipients:  this._recipients
        };

        try {
            const res  = await fetch(`${API}/portal/email-settings/${encodeURIComponent(Portal.activationKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            showInlineAlert(alertEl, res.ok ? `✓ ${data.message}` : (data.message || 'Save failed'), res.ok ? 'success' : 'danger');
        } catch {
            showInlineAlert(alertEl, 'Connection error. Please try again.', 'danger');
        }
    },

    async sendTest() {
        if (!Portal.activationKey) return;
        const btn    = document.getElementById('sendTestBtn');
        const alertEl = document.getElementById('reportSettingsAlert');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Sending...';

        try {
            const res  = await fetch(`${API}/portal/email-settings/${encodeURIComponent(Portal.activationKey)}/test`, {
                method: 'POST'
            });
            const data = await res.json();
            showInlineAlert(alertEl, data.message || (res.ok ? 'Test email sent!' : 'Failed'), res.ok ? 'success' : 'danger');
        } catch {
            showInlineAlert(alertEl, 'Connection error.', 'danger');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane me-1"></i>Test';
        }
    },

    addRecipient() {
        const input   = document.getElementById('newRecipientEmail');
        const alertEl = document.getElementById('recipientAddAlert');
        const email   = input.value.trim().toLowerCase();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showInlineAlert(alertEl, 'Please enter a valid email address.', 'warning');
            return;
        }
        if (this._recipients.includes(email)) {
            showInlineAlert(alertEl, 'That address is already in the list.', 'warning');
            return;
        }
        if (this._recipients.length >= 20) {
            showInlineAlert(alertEl, 'Maximum 20 recipients allowed.', 'warning');
            return;
        }

        this._recipients.push(email);
        input.value = '';
        this._renderRecipients();
    },

    removeRecipient(email) {
        this._recipients = this._recipients.filter(r => r !== email);
        this._renderRecipients();
    },

    _renderRecipients() {
        const list = document.getElementById('recipientList');
        setText('recipientCount', this._recipients.length);

        if (!this._recipients.length) {
            list.innerHTML = '<p class="text-muted text-center small py-3">No recipients yet. Add at least one email address.</p>';
            return;
        }

        list.innerHTML = this._recipients.map(email => `
            <div class="d-flex align-items-center justify-content-between py-2 border-bottom">
                <span><i class="fas fa-envelope text-primary me-2 small"></i>${esc(email)}</span>
                <button class="btn btn-sm btn-outline-danger py-0" onclick="EmailReports.removeRecipient('${esc(email)}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>`).join('');
    }
};

// ============================================================================
// BLOCK PAGE CUSTOMIZATION
// ============================================================================
const BlockPage = {
    _loaded: false,

    async load() {
        const alertEl = document.getElementById('blockPageAlert');
        try {
            const res = await fetch(`${API_BASE}/api/blockpage/settings/${encodeURIComponent(Portal.activationKey)}`);
            const data = await res.json();
            if (!res.ok || !data.success) {
                showInlineAlert(alertEl, data.message || 'Failed to load block page settings.', 'danger');
                return;
            }

            const useCustom = !!data.useCustomMessage;
            document.getElementById('blockMessageDefault').checked = !useCustom;
            document.getElementById('blockMessageCustom').checked = useCustom;
            document.getElementById('blockCustomMessage').value = data.customMessage || '';
            document.getElementById('customMessageContainer').style.display = useCustom ? 'block' : 'none';

            document.getElementById('blockAllowContact').checked = data.allowContact !== false;
            document.getElementById('blockContactEmail').value = data.contactEmail || '';

            const hasLogo = !!data.logoUrl;
            document.getElementById('blockUseLogo').checked = hasLogo;
            document.getElementById('logoContainer').style.display = hasLogo ? 'block' : 'none';
            const preview = document.getElementById('blockLogoPreview');
            if (hasLogo) {
                preview.src = data.logoUrl + '?t=' + Date.now();
                preview.style.display = 'inline-block';
                document.getElementById('blockLogoRemoveBtn').style.display = 'inline-block';
            } else {
                preview.src = '';
                preview.style.display = 'none';
                document.getElementById('blockLogoRemoveBtn').style.display = 'none';
            }

            this._wireEvents();
            this._loaded = true;
        } catch {
            showInlineAlert(alertEl, 'Connection error loading block page settings.', 'danger');
        }
    },

    _wireEvents() {
        if (this._loaded) return;

        document.getElementById('blockMessageDefault').addEventListener('change', () => {
            document.getElementById('customMessageContainer').style.display = 'none';
        });
        document.getElementById('blockMessageCustom').addEventListener('change', () => {
            document.getElementById('customMessageContainer').style.display = 'block';
        });
        document.getElementById('blockUseLogo').addEventListener('change', (e) => {
            document.getElementById('logoContainer').style.display = e.target.checked ? 'block' : 'none';
        });
        document.getElementById('blockLogoFile').addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this.uploadLogo(file);
        });
    },

    async save() {
        const alertEl = document.getElementById('blockPageAlert');
        const useCustomMessage = document.getElementById('blockMessageCustom').checked;
        const customMessage = document.getElementById('blockCustomMessage').value.trim();
        const allowContact = document.getElementById('blockAllowContact').checked;
        const contactEmail = document.getElementById('blockContactEmail').value.trim();

        if (useCustomMessage && !customMessage) {
            showInlineAlert(alertEl, 'Please enter a custom message or choose the default.', 'warning');
            return;
        }
        if (allowContact && contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
            showInlineAlert(alertEl, 'Please enter a valid contact email.', 'warning');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/blockpage/settings/${encodeURIComponent(Portal.activationKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ useCustomMessage, customMessage, allowContact, contactEmail })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                showInlineAlert(alertEl, '✓ Block page settings saved.', 'success');
            } else {
                showInlineAlert(alertEl, data.message || 'Failed to save settings.', 'danger');
            }
        } catch {
            showInlineAlert(alertEl, 'Connection error saving settings.', 'danger');
        }
    },

    async uploadLogo(file) {
        const alertEl = document.getElementById('blockPageAlert');
        if (file.size > 2 * 1024 * 1024) {
            showInlineAlert(alertEl, 'Logo must be 2 MB or smaller.', 'warning');
            return;
        }
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
            showInlineAlert(alertEl, 'Only PNG or JPEG files are accepted.', 'warning');
            return;
        }

        const fd = new FormData();
        fd.append('file', file);

        try {
            const res = await fetch(`${API_BASE}/api/blockpage/logo/${encodeURIComponent(Portal.activationKey)}`, {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const preview = document.getElementById('blockLogoPreview');
                preview.src = data.logoUrl + '?t=' + Date.now();
                preview.style.display = 'inline-block';
                document.getElementById('blockLogoRemoveBtn').style.display = 'inline-block';
                showInlineAlert(alertEl, '✓ Logo uploaded.', 'success');
            } else {
                showInlineAlert(alertEl, data.message || 'Failed to upload logo.', 'danger');
            }
        } catch {
            showInlineAlert(alertEl, 'Connection error uploading logo.', 'danger');
        }
    },

    async removeLogo() {
        const alertEl = document.getElementById('blockPageAlert');
        if (!confirm('Remove the custom logo?')) return;
        try {
            const res = await fetch(`${API_BASE}/api/blockpage/logo/${encodeURIComponent(Portal.activationKey)}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                document.getElementById('blockLogoPreview').src = '';
                document.getElementById('blockLogoPreview').style.display = 'none';
                document.getElementById('blockLogoRemoveBtn').style.display = 'none';
                document.getElementById('blockLogoFile').value = '';
                showInlineAlert(alertEl, '✓ Logo removed.', 'success');
            } else {
                showInlineAlert(alertEl, data.message || 'Failed to remove logo.', 'danger');
            }
        } catch {
            showInlineAlert(alertEl, 'Connection error removing logo.', 'danger');
        }
    },

    preview() {
        // Open the live block page using a sample domain so the admin can see their settings.
        const url = `/blocked/preview/${encodeURIComponent(Portal.activationKey)}`;
        window.open(url, '_blank', 'noopener');
    }
};

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => Portal.init());

'use strict';

const API_BASE_URL = 'https://yjbgqnugsw.us-east-1.awsapprunner.com/api';

document.addEventListener('DOMContentLoaded', () => {
    const key     = sessionStorage.getItem('activationCode') || '';
    const email   = sessionStorage.getItem('customerEmail')  || '';
    const company = sessionStorage.getItem('companyName')    || '';
    const plan    = sessionStorage.getItem('planName')       || '';
    const price   = sessionStorage.getItem('planPrice')      || '';

    if (!key) {
        window.location.href = 'checkout.html';
        return;
    }

    document.getElementById('activationKey').textContent = key;
    document.getElementById('customerEmail').textContent = email;
    document.getElementById('companyName').textContent   = company || '-';
    document.getElementById('planName').textContent      = plan    || '-';
    document.getElementById('planPrice').textContent     = price   ? '$' + Number(price).toLocaleString() : '-';
});

function copyKey() {
    const key = document.getElementById('activationKey').textContent;
    navigator.clipboard.writeText(key).then(() => {
        const icon = document.querySelector('.copy-btn');
        icon.classList.replace('fa-copy', 'fa-check');
        icon.classList.add('text-success');
        setTimeout(() => { icon.classList.replace('fa-check', 'fa-copy'); icon.classList.remove('text-success'); }, 2000);
    });
}

async function downloadInstaller() {
    const key = sessionStorage.getItem('activationCode') || '';
    if (!key) return;
    const btn    = document.getElementById('downloadBtn');
    const status = document.getElementById('downloadStatus');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Preparing installer...';
    status.textContent = '';
    try {
        const response = await fetch(API_BASE_URL + '/purchase/download-installer?key=' + encodeURIComponent(key));
        if (!response.ok) { const e = await response.json().catch(() => ({})); throw new Error(e.error || 'Server error ' + response.status); }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'HTRN85DNS-Setup.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        status.innerHTML = '<i class="fas fa-check-circle text-success me-1"></i>Download started! Extract and run INSTALL.bat as Administrator on each PC.';
        btn.innerHTML = '<i class="fas fa-check me-2"></i>Downloaded';
    } catch (err) {
        status.innerHTML = '<i class="fas fa-exclamation-triangle text-warning me-1"></i>' + err.message;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-download me-2"></i>Download Installer (.zip)';
    }
}

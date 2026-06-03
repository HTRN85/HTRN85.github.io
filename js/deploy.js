'use strict';

const API_BASE = 'https://yjbgqnugsw.us-east-1.awsapprunner.com/api';

async function generateEmail() {
    const keyInput = document.getElementById('activationKeyInput');
    const keyError = document.getElementById('keyError');
    const generateBtn = document.getElementById('generateBtn');
    const key = keyInput.value.trim();

    keyError.style.display = 'none';
    keyError.textContent = '';

    if (!key) {
        keyError.textContent = 'Please enter your activation key.';
        keyError.style.display = 'block';
        return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Loading...';

    try {
        const resp = await fetch(`${API_BASE}/purchase/deploy-email?key=${encodeURIComponent(key)}`);
        const data = await resp.json();

        if (!resp.ok) {
            keyError.textContent = data.error || 'Key not found. Please check and try again.';
            keyError.style.display = 'block';
            return;
        }

        // Populate info bar
        document.getElementById('infoCompany').textContent = data.companyName;
        document.getElementById('infoPlan').textContent = data.planType;
        document.getElementById('infoMax').textContent = data.maxComputers;

        // Populate email fields
        document.getElementById('emailSubject').value = data.subject;
        document.getElementById('emailBody').textContent = data.body;

        // Build mailto link (best-effort — long bodies may be truncated by mail clients)
        const mailto = `mailto:?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
        document.getElementById('mailtoLink').href = mailto;

        // Show panel
        document.getElementById('emailPanel').style.display = 'block';
        document.getElementById('emailPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
        keyError.textContent = `Network error: ${err.message}. Please try again.`;
        keyError.style.display = 'block';
    } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fas fa-envelope me-2"></i>Generate Email';
    }
}

function copyEmailBody() {
    const body = document.getElementById('emailBody').textContent;
    navigator.clipboard.writeText(body).then(() => showToast('Email body copied to clipboard!'));
}

function copyField(id, message) {
    const el = document.getElementById(id);
    const value = el.value !== undefined ? el.value : el.textContent;
    navigator.clipboard.writeText(value).then(() => showToast(message));
}

function showToast(msg) {
    const toast = document.getElementById('copiedToast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

// Allow pressing Enter in the key input
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('activationKeyInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') generateEmail();
    });
});

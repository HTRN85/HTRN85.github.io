/**
 * HTRN85 DNS Security - Success Page JavaScript
 * SECURE IMPLEMENTATION - v2.0
 * 
 * Security Features:
 * - XSS prevention via textContent
 * - Input validation
 * - No sensitive data exposure
 * - Safe clipboard operations
 */

'use strict';

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

const SecurityUtils = {
    /**
     * Sanitize string for display (removes dangerous characters)
     */
    sanitize(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '')
            .trim()
            .substring(0, 500); // Limit length
    },

    /**
     * Validate activation code format
     */
    isValidActivationCode(code) {
        if (!code || typeof code !== 'string') return false;
        // Format: HTRN-XXXX-XXXX-XXXX (alphanumeric)
        return /^HTRN-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
    },

    /**
     * Validate email format
     */
    isValidEmail(email) {
        if (!email || typeof email !== 'string') return false;
        return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(email);
    }
};

// ============================================================================
// UI UTILITIES
// ============================================================================

const UIUtils = {
    /**
     * Set text content safely (XSS-safe)
     */
    setTextContent(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = SecurityUtils.sanitize(String(text || ''));
        }
    },

    /**
     * Format currency safely
     */
    formatCurrency(amount) {
        const num = parseFloat(amount);
        if (isNaN(num) || num < 0) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    },

    /**
     * Show toast notification (XSS-safe)
     */
    showToast(message, type = 'info') {
        // Remove existing toasts
        document.querySelectorAll('.toast-notification').forEach(t => t.remove());

        const iconMap = {
            success: 'check-circle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };

        // Create toast safely
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;

        const icon = document.createElement('i');
        icon.className = `fas fa-${iconMap[type] || 'info-circle'}`;

        const span = document.createElement('span');
        span.textContent = SecurityUtils.sanitize(message);

        toast.appendChild(icon);
        toast.appendChild(span);

        // Add styles if not present
        this.addToastStyles();

        document.body.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    /**
     * Add toast notification styles
     */
    addToastStyles() {
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 1rem 1.5rem;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 1rem;
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
            }
            .toast-success { border-left: 4px solid #28a745; }
            .toast-error { border-left: 4px solid #dc3545; }
            .toast-info { border-left: 4px solid #17a2b8; }
            .toast-success i { color: #28a745; }
            .toast-error i { color: #dc3545; }
            .toast-info i { color: #17a2b8; }
            @keyframes slideInRight {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
};

// ============================================================================
// SUCCESS PAGE LOGIC
// ============================================================================

const SuccessPage = {
    purchaseData: null,

    /**
     * Initialize success page
     */
    init() {
        this.loadPurchaseDetails();
        this.celebrateSuccess();
    },

    /**
     * Load purchase details from session storage
     */
    loadPurchaseDetails() {
        try {
            // Get stored data (from secure checkout.js)
            const activationCode = sessionStorage.getItem('activationCode');
            const customerEmail = sessionStorage.getItem('customerEmail');
            const companyName = sessionStorage.getItem('companyName');
            const planName = sessionStorage.getItem('planName');
            const planPrice = sessionStorage.getItem('planPrice');

            // Validate required data
            if (!activationCode || !SecurityUtils.isValidActivationCode(activationCode)) {
                this.redirectToPricing();
                return;
            }

            if (!customerEmail || !SecurityUtils.isValidEmail(customerEmail)) {
                this.redirectToPricing();
                return;
            }

            // Store validated data
            this.purchaseData = {
                activationCode,
                customerEmail: SecurityUtils.sanitize(customerEmail),
                companyName: SecurityUtils.sanitize(companyName || 'your company'),
                planName: SecurityUtils.sanitize(planName || 'Standard'),
                planPrice: parseFloat(planPrice) || 0
            };

            // Display activation code (textContent is XSS-safe)
            UIUtils.setTextContent('activationCode', activationCode);

            // Display customer info
            UIUtils.setTextContent('customerEmail', this.purchaseData.customerEmail);
            UIUtils.setTextContent('companyName', this.purchaseData.companyName);

            // Display summary
            UIUtils.setTextContent('summaryCompany', this.purchaseData.companyName);
            UIUtils.setTextContent('summaryEmail', this.purchaseData.customerEmail);
            UIUtils.setTextContent('summaryPlan', this.purchaseData.planName + ' Plan');
            UIUtils.setTextContent('summaryAmount', UIUtils.formatCurrency(this.purchaseData.planPrice));

            // Note: Contact name not stored for security (handled server-side)
            UIUtils.setTextContent('summaryContact', 'See email for details');
            UIUtils.setTextContent('summaryClients', 'See email for details');

        } catch (error) {
            console.error('Error loading purchase details');
            this.redirectToPricing();
        }
    },

    /**
     * Redirect to pricing page
     */
    redirectToPricing() {
        // Clear any invalid session data
        this.clearSessionData();
        window.location.href = 'pricing.html';
    },

    /**
     * Clear session data
     */
    clearSessionData() {
        sessionStorage.removeItem('activationCode');
        sessionStorage.removeItem('customerEmail');
        sessionStorage.removeItem('companyName');
        sessionStorage.removeItem('planName');
        sessionStorage.removeItem('planPrice');
    },

    /**
     * Copy activation code to clipboard
     */
    copyActivationCode(event) {
        if (!this.purchaseData?.activationCode) return;

        const code = this.purchaseData.activationCode;

        navigator.clipboard.writeText(code).then(() => {
            // Find button safely
            const button = event?.target?.closest('button');
            if (button) {
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> Copied!';
                button.classList.add('copy-success');

                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.classList.remove('copy-success');
                }, 2000);
            }

            UIUtils.showToast('Activation code copied to clipboard!', 'success');
        }).catch(() => {
            UIUtils.showToast('Failed to copy. Please select and copy manually.', 'error');
        });
    },

    /**
     * Download installer
     */
    downloadInstaller() {
        // Show info message - actual download handled by backend
        UIUtils.showToast('Installer download link will be sent to your email shortly.', 'info');

        // Future: Call backend API
        // ApiClient.request('/installer/generate', { method: 'POST' });
    },

    /**
     * Celebrate success with confetti
     */
    celebrateSuccess() {
        const colors = ['#667eea', '#764ba2', '#28a745', '#ffd700', '#17a2b8'];

        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                this.createConfetti(colors[Math.floor(Math.random() * colors.length)]);
            }, i * 30);
        }
    },

    /**
     * Create single confetti piece
     */
    createConfetti(color) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.cssText = `
            left: ${Math.random() * 100}vw;
            background: ${color};
            animation-duration: ${Math.random() * 3 + 2}s;
            opacity: ${Math.random()};
        `;

        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 5000);
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    SuccessPage.init();
});

// Expose necessary functions to global scope for HTML onclick handlers
window.copyActivationCode = (event) => SuccessPage.copyActivationCode(event);
window.downloadInstaller = () => SuccessPage.downloadInstaller();

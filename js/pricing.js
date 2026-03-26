/**
 * HTRN85 DNS Security - Pricing Page JavaScript
 * SECURE IMPLEMENTATION - v2.0
 * 
 * Security Features:
 * - XSS prevention via DOM manipulation
 * - Input validation and sanitization
 * - No sensitive data exposure
 * - Safe session storage handling
 */

'use strict';

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = Object.freeze({
    MIN_CLIENTS: 1,
    MAX_CLIENTS: 2000,
    MAX_HOURLY_RATE: 10000,
    MAX_HOURS: 1000
});

// Pricing tiers (immutable)
const PRICING_TIERS = Object.freeze([
    { name: 'Starter', min: 0, max: 99, price: 200 },
    { name: 'Growth', min: 100, max: 199, price: 375 },
    { name: 'Business', min: 200, max: 299, price: 750 },
    { name: 'Professional', min: 300, max: 499, price: 1125 },
    { name: 'Enterprise', min: 500, max: 999, price: 2500 },
    { name: 'Enterprise Plus', min: 1000, max: 2000, price: 4000 }
]);

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

const SecurityUtils = {
    /**
     * Sanitize string for safe display
     */
    sanitize(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>]/g, '').trim();
    },

    /**
     * Validate number within range
     */
    isValidNumber(value, min, max) {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num) && num >= min && num <= max;
    },

    /**
     * Safely parse integer
     */
    safeParseInt(value, defaultValue = 0) {
        const num = parseInt(value, 10);
        return isNaN(num) ? defaultValue : num;
    },

    /**
     * Safely parse float
     */
    safeParseFloat(value, defaultValue = 0) {
        const num = parseFloat(value);
        return isNaN(num) || !isFinite(num) ? defaultValue : num;
    }
};

// ============================================================================
// UI UTILITIES
// ============================================================================

const UIUtils = {
    /**
     * Format currency safely
     */
    formatCurrency(amount) {
        const num = SecurityUtils.safeParseFloat(amount, 0);
        if (num < 0) return '$0';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    },

    /**
     * Set text content safely (XSS-safe)
     */
    setTextContent(elementId, text) {
        const el = document.getElementById(elementId);
        if (el) el.textContent = String(text);
    },

    /**
     * Get input value safely
     */
    getInputValue(elementId) {
        const el = document.getElementById(elementId);
        return el ? el.value : '';
    }
};

// ============================================================================
// PRICING CALCULATOR
// ============================================================================

const PricingCalculator = {
    /**
     * Calculate price based on number of clients
     */
    calculatePrice(numClients) {
        const num = SecurityUtils.safeParseInt(numClients, 0);
        return PRICING_TIERS.find(t => num >= t.min && num <= t.max) || null;
    },

    /**
     * Update price calculator display
     */
    updateCalculator() {
        const clientCountInput = document.getElementById('clientCount');
        if (!clientCountInput) return;

        const clientCount = SecurityUtils.safeParseInt(clientCountInput.value, 0);
        const resultContainer = document.getElementById('calculatorResult');
        if (!resultContainer) return;

        // Clear previous content
        resultContainer.innerHTML = '';

        // Invalid input
        if (clientCount < CONFIG.MIN_CLIENTS) {
            const msg = document.createElement('p');
            msg.className = 'text-center text-muted';
            msg.textContent = `Enter a valid number of clients (${CONFIG.MIN_CLIENTS}-${CONFIG.MAX_CLIENTS})`;
            resultContainer.appendChild(msg);
            return;
        }

        // Over limit - show contact sales
        if (clientCount > CONFIG.MAX_CLIENTS) {
            const container = document.createElement('div');
            container.className = 'text-center';

            const title = document.createElement('h4');
            title.className = 'fw-bold text-primary mb-3';
            title.textContent = 'Custom Enterprise Solution';

            const desc = document.createElement('p');
            desc.className = 'mb-3';
            desc.textContent = 'For 2,000+ clients, we offer custom pricing and dedicated solutions.';

            const btn = document.createElement('button');
            btn.className = 'btn btn-primary btn-lg';
            btn.textContent = 'Contact Sales';
            btn.onclick = () => PricingPage.contactSales();

            container.appendChild(title);
            container.appendChild(desc);
            container.appendChild(btn);
            resultContainer.appendChild(container);
            return;
        }

        // Calculate tier
        const tier = this.calculatePrice(clientCount);
        if (!tier) {
            const msg = document.createElement('p');
            msg.className = 'text-center text-muted';
            msg.textContent = `Enter a valid number of clients (${CONFIG.MIN_CLIENTS}-${CONFIG.MAX_CLIENTS})`;
            resultContainer.appendChild(msg);
            return;
        }

        // Build result display (XSS-safe DOM manipulation)
        const tierDiv = document.createElement('div');
        tierDiv.className = 'result-tier';

        const tierTitle = document.createElement('h4');
        tierTitle.className = 'fw-bold mb-2';
        tierTitle.textContent = 'Your Plan: ';

        const tierName = document.createElement('span');
        tierName.className = 'text-primary';
        tierName.id = 'tierName';
        tierName.textContent = tier.name;
        tierTitle.appendChild(tierName);

        const tierRange = document.createElement('p');
        tierRange.className = 'text-muted mb-3';
        tierRange.textContent = `Coverage: ${tier.min}-${tier.max} clients`;

        tierDiv.appendChild(tierTitle);
        tierDiv.appendChild(tierRange);

        const priceDiv = document.createElement('div');
        priceDiv.className = 'result-price';

        const priceDisplay = document.createElement('div');
        priceDisplay.className = 'price-display';

        const currency = document.createElement('span');
        currency.className = 'price-currency';
        currency.textContent = '$';

        const amount = document.createElement('span');
        amount.className = 'price-amount';
        amount.textContent = tier.price.toLocaleString();

        const period = document.createElement('span');
        period.className = 'price-period';
        period.textContent = '/year';

        priceDisplay.appendChild(currency);
        priceDisplay.appendChild(amount);
        priceDisplay.appendChild(period);

        const perClientText = document.createElement('p');
        perClientText.className = 'text-muted mb-3';
        const perClientAmount = (tier.price / clientCount).toFixed(2);
        perClientText.innerHTML = `That's only <strong>$${perClientAmount}</strong> per client/year`;

        const checkoutBtn = document.createElement('button');
        checkoutBtn.className = 'btn btn-primary btn-lg w-100';
        checkoutBtn.innerHTML = '<i class="fas fa-shopping-cart"></i> Get Started Now';
        checkoutBtn.onclick = () => PricingPage.proceedToCheckout();

        priceDiv.appendChild(priceDisplay);
        priceDiv.appendChild(perClientText);
        priceDiv.appendChild(checkoutBtn);

        resultContainer.appendChild(tierDiv);
        resultContainer.appendChild(priceDiv);
    }
};

// ============================================================================
// ROI CALCULATOR
// ============================================================================

const ROICalculator = {
    /**
     * Calculate ROI based on inputs
     */
    calculate() {
        const employees = SecurityUtils.safeParseInt(UIUtils.getInputValue('roiEmployees'), 0);
        const hourlyRate = SecurityUtils.safeParseFloat(UIUtils.getInputValue('roiHourlyRate'), 0);
        const hoursPerMonth = SecurityUtils.safeParseFloat(UIUtils.getInputValue('roiHours'), 0);

        // Validate inputs
        if (!SecurityUtils.isValidNumber(employees, 0, CONFIG.MAX_CLIENTS)) return;
        if (!SecurityUtils.isValidNumber(hourlyRate, 0, CONFIG.MAX_HOURLY_RATE)) return;
        if (!SecurityUtils.isValidNumber(hoursPerMonth, 0, CONFIG.MAX_HOURS)) return;

        // Calculate current annual cost
        const currentAnnualCost = hourlyRate * hoursPerMonth * 12;
        UIUtils.setTextContent('roiCurrentCost', UIUtils.formatCurrency(currentAnnualCost));

        // Calculate our cost
        const tier = PricingCalculator.calculatePrice(employees);
        const ourCost = tier ? tier.price : 4000;
        UIUtils.setTextContent('roiOurCost', UIUtils.formatCurrency(ourCost));

        // Calculate savings (80% reduction assumption)
        const timeSavedPercent = 80;
        const costSaved = currentAnnualCost * (timeSavedPercent / 100);
        const netSavings = costSaved - ourCost;

        UIUtils.setTextContent('roiTimeSaved', timeSavedPercent + '%');
        UIUtils.setTextContent('roiSavings', UIUtils.formatCurrency(Math.max(0, netSavings)));

        // Calculate ROI percentage
        const roiPercent = ourCost > 0 ? Math.round((netSavings / ourCost) * 100) : 0;
        UIUtils.setTextContent('roiPercent', Math.max(0, roiPercent) + '%');
    }
};

// ============================================================================
// PRICING PAGE LOGIC
// ============================================================================

const PricingPage = {
    /**
     * Initialize pricing page
     */
    init() {
        this.initializePriceCalculator();
        this.initializeROICalculator();
        this.addScrollAnimations();
    },

    /**
     * Initialize price calculator
     */
    initializePriceCalculator() {
        const clientCountInput = document.getElementById('clientCount');
        if (clientCountInput) {
            clientCountInput.addEventListener('input', () => PricingCalculator.updateCalculator());
            PricingCalculator.updateCalculator();
        }
    },

    /**
     * Initialize ROI calculator
     */
    initializeROICalculator() {
        const roiInputs = ['roiEmployees', 'roiHourlyRate', 'roiHours'];
        roiInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => ROICalculator.calculate());
            }
        });

        if (document.getElementById('roiEmployees')) {
            ROICalculator.calculate();
        }
    },

    /**
     * Select a tier and proceed to checkout
     */
    selectTier(tierName, price, maxClients) {
        // Validate inputs before storing
        if (typeof tierName !== 'string' || !tierName) return;
        if (typeof price !== 'number' || price <= 0) return;
        if (typeof maxClients !== 'number' || maxClients <= 0) return;

        // Store selection (sanitized)
        sessionStorage.setItem('selectedPlan', JSON.stringify({
            name: SecurityUtils.sanitize(tierName),
            price: Math.abs(price),
            maxClients: Math.abs(maxClients)
        }));

        window.location.href = 'checkout.html';
    },

    /**
     * Proceed to checkout with calculated price
     */
    proceedToCheckout() {
        const clientCount = SecurityUtils.safeParseInt(UIUtils.getInputValue('clientCount'), 0);
        const tier = PricingCalculator.calculatePrice(clientCount);

        if (tier) {
            this.selectTier(tier.name, tier.price, tier.max);
        } else {
            alert('Please enter a valid number of clients (1-2000)');
        }
    },

    /**
     * Contact sales
     */
    contactSales() {
        window.location.href = 'mailto:sales@htrn85dns.com?subject=Enterprise%20Sales%20Inquiry&body=Hi%2C%20I%27m%20interested%20in%20an%20enterprise%20DNS%20Security%20plan.%20Please%20contact%20me.';
    },

    /**
     * Scroll to calculator
     */
    scrollToCalculator() {
        const calculator = document.querySelector('.price-calculator');
        if (calculator) {
            calculator.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                document.getElementById('clientCount')?.focus();
            }, 500);
        }
    },

    /**
     * Add scroll animations
     */
    addScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);

        document.querySelectorAll('.pricing-tier-card, .roi-calculator, .comparison-table').forEach(el => {
            observer.observe(el);
        });
    },

    /**
     * Share pricing page
     */
    sharePricing() {
        const url = window.location.href;
        const text = 'Check out HTRN85 DNS Security - Simple, transparent pricing for roaming client protection!';

        if (navigator.share) {
            navigator.share({ title: 'HTRN85 DNS Pricing', text, url }).catch(() => {});
        } else {
            navigator.clipboard.writeText(url).then(() => {
                alert('Link copied to clipboard!');
            }).catch(() => {});
        }
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    PricingPage.init();
});

// Expose necessary functions to global scope for HTML onclick handlers
window.selectTier = (name, price, max) => PricingPage.selectTier(name, price, max);
window.proceedToCheckout = () => PricingPage.proceedToCheckout();
window.contactSales = () => PricingPage.contactSales();
window.scrollToCalculator = () => PricingPage.scrollToCalculator();
window.sharePricing = () => PricingPage.sharePricing();

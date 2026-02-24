/* ============================================
   AGROMART - GLOBAL SITE LOGIC
   Handles dynamic contact details and common elements
   ============================================ */

document.addEventListener('DOMContentLoaded', async function () {
    // Wait for data from API
    await initData();
    initGlobalContactDetails();
});

function initGlobalContactDetails() {
    const phone = getWhatsAppNumber();
    const email = getContactEmail();
    const address = getContactAddress();
    const social = getSocialLinks();

    // FOOTER UPDATES
    const footerPhone = document.getElementById('footerPhone');
    if (footerPhone) footerPhone.textContent = `+${formatPhoneNumber(phone)}`;

    const footerContactList = document.querySelector('.footer-contact');
    if (footerContactList) {
        footerContactList.innerHTML = `
            <li><i class="fas fa-phone"></i> <a href="tel:+${phone}">+${formatPhoneNumber(phone)}</a></li>
            <li><i class="fas fa-envelope"></i> <a href="mailto:${email}">${email}</a></li>
            <li><i class="fas fa-map-marker-alt"></i> ${address}</li>
             <li class="footer-social">
                ${social.facebook ? `<a href="${social.facebook}" target="_blank"><i class="fab fa-facebook-f"></i></a>` : ''}
                ${social.instagram ? `<a href="${social.instagram}" target="_blank"><i class="fab fa-instagram"></i></a>` : ''}
                ${social.twitter ? `<a href="${social.twitter}" target="_blank"><i class="fab fa-twitter"></i></a>` : ''}
                ${social.linkedin ? `<a href="${social.linkedin}" target="_blank"><i class="fab fa-linkedin-in"></i></a>` : ''}
            </li>
        `;
    }
}

function formatPhoneNumber(phone) {
    if (!phone) return '';
    if (phone.length === 12 && phone.startsWith('91')) {
        return `${phone.substring(0, 2)} ${phone.substring(2, 7)} ${phone.substring(7)}`;
    }
    return phone;
}

/**
 * Checks if a cooldown period has passed for a specific action.
 * @param {string} type - The type of action (e.g., 'whatsapp', 'email')
 * @returns {object} - { allowed: boolean, remaining: number }
 */
function checkMessagingCooldown(type) {
    return checkActionLimit(type, 60, 0, 0); // Preserves existing single-gap logic for 'whatsapp' order
}

/**
 * Generic rate-limiting function for user actions.
 * @param {string} type - Action type (e.g., 'chat', 'order')
 * @param {number} gapSeconds - Minimum seconds between actions (cooldown)
 * @param {number} maxAttempts - Maximum attempts allowed in the window (0 for no limit)
 * @param {number} windowSeconds - Time window for maxAttempts in seconds (e.g., 3600 for 1 hour)
 * @returns {object} - { allowed: boolean, remaining: number, errorType: string }
 */
function checkActionLimit(type, gapSeconds, maxAttempts, windowSeconds) {
    try {
        const now = Date.now();
        const gapMs = gapSeconds * 1000;
        const windowMs = windowSeconds * 1000;
        const cooldownKey = `agro_cooldown_${type}`;
        const historyKey = `agro_history_${type}`;

        // 1. Check Cooldown Gap
        let lastSent;
        try {
            lastSent = localStorage.getItem(cooldownKey);
        } catch {
            lastSent = getSessionData(cooldownKey);
        }

        if (lastSent && (now - parseInt(lastSent)) < gapMs) {
            const remaining = Math.ceil((gapMs - (now - parseInt(lastSent))) / 1000);
            return { allowed: false, remaining, errorType: 'cooldown' };
        }

        // 2. Check Window Limit (e.g., 5 per hour)
        if (maxAttempts > 0 && windowSeconds > 0) {
            let history = [];
            try {
                history = JSON.parse(localStorage.getItem(historyKey) || '[]');
            } catch {
                history = JSON.parse(getSessionData(historyKey) || '[]');
            }

            // Filter history to current window
            history = history.filter(time => (now - time) < windowMs);

            if (history.length >= maxAttempts) {
                // Return time until the oldest record in the window expires
                const oldest = history[0];
                const waitMs = windowMs - (now - oldest);
                const remaining = Math.ceil(waitMs / 1000);
                return { allowed: false, remaining, errorType: 'limit' };
            }

            // Update history
            history.push(now);
            try {
                localStorage.setItem(historyKey, JSON.stringify(history));
            } catch {
                setSessionData(historyKey, JSON.stringify(history));
            }
        }

        // Update last sent time
        try {
            localStorage.setItem(cooldownKey, now.toString());
        } catch {
            setSessionData(cooldownKey, now.toString());
        }

        return { allowed: true };
    } catch (err) {
        console.warn('Rate limit check failed:', err.message);
        return { allowed: true };
    }
}

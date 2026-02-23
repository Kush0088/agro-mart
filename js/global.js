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
 * @returns {boolean} - True if allowed, False if still on cooldown
 */
function checkMessagingCooldown(type) {
    try {
        const now = Date.now();
        const cooldownMs = 60 * 1000; // 1 minute
        const storageKey = `agro_cooldown_${type}`;

        let lastSent;
        try {
            lastSent = localStorage.getItem(storageKey);
        } catch {
            // Fallback to session storage if localStorage fails
            lastSent = getSessionData(storageKey);
        }

        if (lastSent && (now - parseInt(lastSent)) < cooldownMs) {
            const remaining = Math.ceil((cooldownMs - (now - parseInt(lastSent))) / 1000);
            return { allowed: false, remaining };
        }

        try {
            localStorage.setItem(storageKey, now.toString());
        } catch {
            // Fallback to session storage if localStorage fails
            setSessionData(storageKey, now.toString());
        }
        return { allowed: true };
    } catch (err) {
        console.warn('Failed to check messaging cooldown:', err.message);
        // Fallback: allow the message if storage fails
        return { allowed: true };
    }
}

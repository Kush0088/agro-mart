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
            <li><i class="fas fa-phone"></i> <a href="tel:+${escapeHTML(phone)}">+${escapeHTML(formatPhoneNumber(phone))}</a></li>
            <li><i class="fas fa-envelope"></i> <a href="mailto:${escapeHTML(email)}">${escapeHTML(email)}</a></li>
            <li><i class="fas fa-map-marker-alt"></i> ${escapeHTML(address)}</li>
             <li class="footer-social">
                ${social.facebook ? `<a href="${escapeHTML(social.facebook)}" target="_blank"><i class="fab fa-facebook-f"></i></a>` : ''}
                ${social.instagram ? `<a href="${escapeHTML(social.instagram)}" target="_blank"><i class="fab fa-instagram"></i></a>` : ''}
                ${social.twitter ? `<a href="${escapeHTML(social.twitter)}" target="_blank"><i class="fab fa-twitter"></i></a>` : ''}
                ${social.linkedin ? `<a href="${escapeHTML(social.linkedin)}" target="_blank"><i class="fab fa-linkedin-in"></i></a>` : ''}
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
 * Allows 5 messages per 1 hour window.
 * @param {string} type - The type of action (e.g., 'whatsapp', 'email')
 * @returns {object} - { allowed: boolean, remaining: number, unit: string }
 */
function checkMessagingCooldown(type) {
    const now = Date.now();
    const cooldownWindowMs = 60 * 60 * 1000; // 1 hour
    const maxAllowed = 5;
    const storageKey = `agro_cooldown_history_${type}`;

    let timestamps = JSON.parse(localStorage.getItem(storageKey) || '[]');

    // Filter out timestamps older than 1 hour
    timestamps = timestamps.filter(ts => (now - ts) < cooldownWindowMs);

    if (timestamps.length >= maxAllowed) {
        // Find how long until the oldest timestamp falls out of the window
        const oldest = timestamps[0];
        const remainingMs = cooldownWindowMs - (now - oldest);
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        return { allowed: false, remaining: remainingMinutes, unit: 'minutes' };
    }

    timestamps.push(now);
    localStorage.setItem(storageKey, JSON.stringify(timestamps));
    return { allowed: true };
}

/**
 * Escapes HTML characters to prevent XSS.
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Validates if a URL is a proper image URL.
 * Prevents loading broken or malformed URLs.
 * @param {string} url - The URL to validate
 * @returns {boolean} - True if URL is valid
 */
function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // Remove URL encoding artifacts like %20 at the end
    const cleanUrl = url.trim();
    
    // Check for malformed patterns
    if (cleanUrl.includes('%20') && cleanUrl.endsWith('%20001')) return false;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://') && !cleanUrl.startsWith('data:')) {
        // Allow relative URLs like images/product.png
        return /^[a-zA-Z0-9._\-\/]+\.(jpg|jpeg|png|gif|webp)$/i.test(cleanUrl) || cleanUrl.startsWith('/');
    }
    
    try {
        const urlObj = new URL(cleanUrl);
        // Check if it's a valid image extension or data URL
        const pathname = urlObj.pathname.toLowerCase();
        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pathname) || cleanUrl.startsWith('data:');
    } catch {
        return false;
    }
}

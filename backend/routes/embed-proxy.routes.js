/**
 * Advanced Embed Proxy with HTML Rewriting & Ad Blocking
 * Based on JSDOM + CSP + Guard Script Injection
 * 
 * This proxy:
 * 1. Fetches third-party embed HTML
 * 2. Parses with JSDOM and rewrites URLs to go through asset proxy
 * 3. Strips known ad/popup scripts
 * 4. Injects anti-popup guard script at top of head
 * 5. Sets strict CSP headers
 * 6. Proxies all assets and blocks ad domains
 */

const express = require('express');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const router = express.Router();

// ============ CONFIGURATION ============

// Known ad/popup script patterns to strip
const AD_SCRIPT_PATTERNS = [
    /ads?\.js/i,
    /pop(up)?\.js/i,
    /doubleclick/i,
    /googlesyndication/i,
    /adservice/i,
    /popunder/i,
    /tracking/i,
    /analytics(?!\.video)/i,  // analytics but not video analytics
    /taboola/i,
    /outbrain/i,
    /mgid/i,
    /revcontent/i,
    /adnxs/i,
    /criteo/i,
    /pubmatic/i,
    // NEW: Block tracking/analytics
    /googletagmanager/i,
    /gtag\/js/i,
    /google-analytics/i,
    /mc\.yandex/i,
    /yandex.*watch/i,
    /cloudflareinsights/i,
    /beacon\.min\.js/i,
    /rum\?/i,
    /cdn-cgi\/rum/i,
    // NEW: More popup patterns
    /overlay/i,
    /interstitial/i,
    /prebid/i,
    /click.*track/i
];

// Known ad domains to block completely
const BLOCKED_DOMAINS = [
    // Ad networks
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'adservice.google.com',
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'mgid.com',
    'taboola.com',
    'outbrain.com',
    'adnxs.com',
    'criteo.com',
    'pubmatic.com',
    'revcontent.com',
    'exoclick.com',
    'juicyads.com',
    'trafficjunky.com',
    // NEW: Tracking/Analytics (These cause popups too!)
    'googletagmanager.com',
    'google-analytics.com',
    'mc.yandex.ru',
    'yandex.ru/watch',
    'static.cloudflareinsights.com',
    'cloudflareinsights.com',
    // NEW: More ad networks
    'adskeeper.com',
    'adsterra.com',
    'bidvertiser.com',
    'clickadu.com',
    'hilltopads.net',
    'monetag.com',
    'richads.com',
    'trafficstars.com'
];

// Inline script patterns to remove
const INLINE_SCRIPT_PATTERNS = [
    /window\.open\s*\(/i,
    /\.pop(up|under)/i,
    /onclick\s*=.*window\.open/i,
    /adsbygoogle/i,
    // NEW: More inline patterns
    /location\s*=\s*["']/i,
    /top\.location/i,
    /parent\.location/i,
    /window\.location\s*=/i,
    /document\.location\s*=/i
];

// ============ UTILITY FUNCTIONS ============

function absoluteUrl(base, url) {
    if (!url) return url;
    try {
        return new URL(url, base).toString();
    } catch {
        return url;
    }
}

function isAdUrl(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return BLOCKED_DOMAINS.some(domain => lowerUrl.includes(domain)) ||
           AD_SCRIPT_PATTERNS.some(pattern => pattern.test(url));
}

function shouldStripScript(scriptEl) {
    const src = scriptEl.getAttribute('src') || '';
    const content = scriptEl.textContent || '';
    
    // Check src against patterns
    if (AD_SCRIPT_PATTERNS.some(pattern => pattern.test(src))) {
        return true;
    }
    
    // Check inline content
    if (INLINE_SCRIPT_PATTERNS.some(pattern => pattern.test(content))) {
        return true;
    }
    
    return false;
}

// ============ THE GUARD SCRIPT ============
// This gets injected at TOP of <head> to run before any ad scripts

const GUARD_SCRIPT = `
<script data-guard="flashplay-adblocker">
(function() {
    'use strict';
    console.log("[FlashPlay Guard] 🛡️ Anti-Popup Guard Active!");
    
    // Track user interaction to allow legitimate clicks
    var userClicked = false;
    var clickTimeout = null;
    
    // ====== 1. Block window.open completely ======
    const fakeWindow = {
        close: function(){},
        focus: function(){},
        blur: function(){},
        postMessage: function(){},
        document: { write: function(){}, open: function(){}, close: function(){} },
        location: { href: 'about:blank' },
        closed: false,
        opener: null,
        parent: window,
        self: null,
        name: ''
    };
    Object.freeze(fakeWindow);
    
    try {
        Object.defineProperty(window, 'open', {
            configurable: false,
            writable: false,
            value: function(url, name, specs) {
                console.warn("[FlashPlay Guard] 🚫 Blocked popup:", url);
                return fakeWindow;
            }
        });
    } catch(e) {
        window.open = function() { return fakeWindow; };
    }
    
    // ====== 2. Block location hijacking ======
    try {
        // Block top.location
        Object.defineProperty(window, 'top', { get: function() { return window; } });
    } catch(e) {}
    
    // Block parent.location for nested iframes
    try {
        Object.defineProperty(window, 'parent', { get: function() { return window; } });
    } catch(e) {}
    
    // ====== 3. AGGRESSIVE: Intercept ALL clicks on suspicious elements ======
    document.addEventListener('click', function(e) {
        var target = e.target;
        
        // Check if click is on an overlay (transparent div on top of video)
        var isOverlay = false;
        var el = target;
        while (el && el !== document.body) {
            var style = window.getComputedStyle ? window.getComputedStyle(el) : el.style;
            var pos = style.position;
            var zIndex = parseInt(style.zIndex) || 0;
            var opacity = parseFloat(style.opacity);
            
            // Detect invisible overlays: fixed/absolute position, high z-index, or low opacity
            if ((pos === 'fixed' || pos === 'absolute') && 
                (zIndex > 100 || opacity < 0.1 || style.pointerEvents === 'auto')) {
                // Check if it's NOT the video player itself
                var tagName = el.tagName.toLowerCase();
                if (tagName !== 'video' && tagName !== 'iframe' && !el.classList.contains('jw-')) {
                    isOverlay = true;
                    break;
                }
            }
            el = el.parentElement;
        }
        
        if (isOverlay) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.warn("[FlashPlay Guard] 🚫 Blocked overlay click - likely ad overlay");
            return false;
        }
        
        // Check for links
        var a = target.closest ? target.closest('a') : null;
        if (a) {
            var href = a.getAttribute('href') || '';
            var target_attr = a.getAttribute('target') || '';
            
            // Block: blank targets, javascript:, or ad-like URLs
            if (target_attr === '_blank' || 
                href.startsWith('javascript:') || 
                /ads?|pop|redirect|track|click|offer|promo|sponsor|banner/i.test(href)) {
                e.preventDefault();
                e.stopPropagation();
                console.warn("[FlashPlay Guard] 🚫 Blocked link click:", href);
                return false;
            } else {
                a.setAttribute('rel', 'noopener noreferrer');
            }
        }
    }, true);
    
    // ====== 4. Block programmatic clicks ======
    var realClick = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function() {
        var tag = (this.tagName || '').toLowerCase();
        if (tag === 'a') {
            var href = this.getAttribute('href') || '';
            if (/ads?|pop|redirect|track|click|offer|sponsor/i.test(href)) {
                console.warn("[FlashPlay Guard] 🚫 Blocked programmatic click:", href);
                return;
            }
        }
        return realClick.apply(this, arguments);
    };
    
    // ====== 5. Block beforeunload hijacking ======
    window.onbeforeunload = null;
    try {
        Object.defineProperty(window, 'onbeforeunload', {
            configurable: false,
            set: function() {},
            get: function() { return null; }
        });
    } catch(e) {}
    
    // ====== 6. Block createElement for ad iframes/scripts ======
    var realCreateElement = document.createElement.bind(document);
    document.createElement = function(tag) {
        var el = realCreateElement(tag);
        var tagLower = tag.toLowerCase();
        
        if (tagLower === 'iframe') {
            var originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
            Object.defineProperty(el, 'src', {
                set: function(v) {
                    if (/ads?|pop|track|doubleclick|googlead|sponsor/i.test(v)) {
                        console.warn("[FlashPlay Guard] 🚫 Blocked ad iframe:", v);
                        return;
                    }
                    if (originalSrcDescriptor && originalSrcDescriptor.set) {
                        originalSrcDescriptor.set.call(this, v);
                    }
                },
                get: function() {
                    return originalSrcDescriptor && originalSrcDescriptor.get ? originalSrcDescriptor.get.call(this) : '';
                }
            });
        }
        
        if (tagLower === 'script') {
            var originalScriptSrc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
            Object.defineProperty(el, 'src', {
                set: function(v) {
                    if (/ads?|pop|track|googletagmanager|analytics|doubleclick/i.test(v)) {
                        console.warn("[FlashPlay Guard] 🚫 Blocked ad script:", v);
                        return;
                    }
                    if (originalScriptSrc && originalScriptSrc.set) {
                        originalScriptSrc.set.call(this, v);
                    }
                },
                get: function() {
                    return originalScriptSrc && originalScriptSrc.get ? originalScriptSrc.get.call(this) : '';
                }
            });
        }
        
        return el;
    };
    
    // ====== 7. Block fetch/XHR to tracking endpoints ======
    var realFetch = window.fetch;
    window.fetch = function(url, options) {
        var urlStr = typeof url === 'string' ? url : (url.url || '');
        if (/googletagmanager|analytics|doubleclick|mc\\.yandex|cloudflareinsights|rum\\?/i.test(urlStr)) {
            console.warn("[FlashPlay Guard] 🚫 Blocked tracking fetch:", urlStr);
            return Promise.resolve(new Response('', {status: 204}));
        }
        return realFetch.apply(this, arguments);
    };
    
    // ====== 8. Block sendBeacon (used for tracking) ======
    if (navigator.sendBeacon) {
        var realSendBeacon = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function(url, data) {
            if (/analytics|track|rum|beacon/i.test(url)) {
                console.warn("[FlashPlay Guard] 🚫 Blocked beacon:", url);
                return true; // Pretend it succeeded
            }
            return realSendBeacon(url, data);
        };
    }
    
    // ====== 9. Remove existing overlays periodically ======
    setInterval(function() {
        // Find and remove suspicious overlay divs
        document.querySelectorAll('div, a').forEach(function(el) {
            var style = window.getComputedStyle ? window.getComputedStyle(el) : el.style;
            var pos = style.position;
            var zIndex = parseInt(style.zIndex) || 0;
            
            if ((pos === 'fixed' || pos === 'absolute') && zIndex > 9000) {
                var rect = el.getBoundingClientRect();
                // Full screen or large overlays
                if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8) {
                    var tagName = el.tagName.toLowerCase();
                    if (tagName !== 'video' && !el.querySelector('video') && !el.classList.contains('jw-')) {
                        el.style.display = 'none';
                        console.warn("[FlashPlay Guard] 🚫 Hidden suspicious overlay");
                    }
                }
            }
        });
    }, 2000);
    
    console.log("[FlashPlay Guard] ✅ All protections initialized (v2.0)");
})();
</script>
`;


// ============ MAIN EMBED PROXY ROUTE ============

/**
 * GET /api/embed?url=<encoded_url>
 * Fetches, rewrites, and serves the embed with ad blocking
 */
router.get('/', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }
    
    try {
        console.log(`[Embed Proxy] Fetching: ${targetUrl}`);
        
        // 1. Fetch original HTML
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': new URL(targetUrl).origin
            },
            redirect: 'follow'
        });
        
        if (!response.ok) {
            throw new Error(`Upstream error: ${response.status}`);
        }
        
        const html = await response.text();
        const baseUrl = new URL(targetUrl).origin;
        
        // 2. Parse with JSDOM
        const dom = new JSDOM(html);
        const { document } = dom.window;
        
        // 3. Rewrite all src/href attributes to go through asset proxy
        const urlAttrs = ['src', 'href', 'poster', 'data-src'];
        document.querySelectorAll('*').forEach(el => {
            urlAttrs.forEach(attr => {
                const value = el.getAttribute && el.getAttribute(attr);
                if (!value) return;
                
                // Skip anchors and javascript:
                if (attr === 'href' && (value.startsWith('#') || value.startsWith('javascript:'))) {
                    return;
                }
                
                const absUrl = absoluteUrl(targetUrl, value);
                
                // Check if it's an ad URL - remove the element entirely
                if (isAdUrl(absUrl)) {
                    console.log(`[Embed Proxy] Stripped ad element: ${absUrl}`);
                    el.remove();
                    return;
                }
                
                // Rewrite to go through asset proxy
                if (/^https?:\/\//i.test(absUrl)) {
                    el.setAttribute(attr, `/api/embed/asset?url=${encodeURIComponent(absUrl)}`);
                }
            });
        });
        
        // 4. Strip ad/popup scripts
        document.querySelectorAll('script').forEach(script => {
            if (shouldStripScript(script)) {
                console.log(`[Embed Proxy] Stripped script: ${script.getAttribute('src') || '[inline]'}`);
                script.remove();
            }
        });
        
        // 5. Remove onclick handlers with popup patterns
        document.querySelectorAll('[onclick]').forEach(el => {
            const onclick = el.getAttribute('onclick') || '';
            if (/window\.open|pop|redirect/i.test(onclick)) {
                el.removeAttribute('onclick');
            }
        });
        
        // 6. Inject guard script at TOP of head
        if (document.head) {
            document.head.insertAdjacentHTML('afterbegin', GUARD_SCRIPT);
        } else if (document.documentElement) {
            document.documentElement.insertAdjacentHTML('afterbegin', '<head>' + GUARD_SCRIPT + '</head>');
        }
        
        // 7. Add base tag for relative URLs that we might miss
        const baseTag = document.createElement('base');
        baseTag.href = baseUrl + '/';
        if (document.head) {
            document.head.prepend(baseTag);
        }
        
        // 8. Serialize modified HTML
        const modifiedHtml = dom.serialize();
        
        // 9. Set strict CSP headers
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Need unsafe-inline for embedded players
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "media-src 'self' data: blob: https:",
            "connect-src 'self' https:",
            "frame-src 'self' https:",
            "font-src 'self' data: https:",
            "object-src 'none'",
            "base-uri 'self'"
        ].join('; ');
        
        res.setHeader('Content-Security-Policy', csp);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        
        // Remove X-Frame-Options to allow embedding
        res.removeHeader('X-Frame-Options');
        
        console.log(`[Embed Proxy] Successfully processed: ${targetUrl}`);
        res.send(modifiedHtml);
        
    } catch (error) {
        console.error('[Embed Proxy] Error:', error);
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
});

// ============ ASSET PROXY ROUTE ============

/**
 * GET /api/embed/asset?url=<encoded_url>
 * Proxies individual assets, blocks ad domains
 */
router.get('/asset', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }
    
    try {
        // Block known ad domains
        if (isAdUrl(targetUrl)) {
            console.log(`[Asset Proxy] Blocked ad domain: ${targetUrl}`);
            return res.status(204).end(); // Return empty response
        }
        
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': new URL(targetUrl).origin
            },
            redirect: 'follow'
        });
        
        if (!response.ok) {
            return res.status(response.status).end();
        }
        
        // Pass through content type
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        // For video/audio, set permissive caching
        if (contentType.includes('video') || contentType.includes('audio') || contentType.includes('mpegurl')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
        
        // Pipe response body
        response.body.pipe(res);
        
    } catch (error) {
        console.error('[Asset Proxy] Error:', error.message);
        res.status(500).end();
    }
});

module.exports = router;

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
        
        // A. Prevent ALL form submissions via click
        if (target.type === 'submit' || target.tagName === 'BUTTON') {
             var form = target.closest('form');
             if (form) {
                 e.preventDefault();
                 e.stopPropagation();
                 console.warn("[FlashPlay Guard] 🚫 Blocked form submission button");
                 return false;
             }
        }

                // B. Check if click is on an overlay (existing logic)
        var isOverlay = false;
        var el = target;
        while (el && el !== document.body) {
            var style = window.getComputedStyle ? window.getComputedStyle(el) : el.style;
            var pos = style.position;
            var zIndex = parseInt(style.zIndex) || 0;
            var opacity = parseFloat(style.opacity);
            
            // Detect invisible overlays
            if ((pos === 'fixed' || pos === 'absolute') && 
                (zIndex > 100 || opacity < 0.1 || style.pointerEvents === 'auto')) {
                
                var tagName = el.tagName.toLowerCase();
                var className = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
                
                // Whitelist legitimate player controls (JWPlayer, ArtPlayer, VideoJS, Plyr)
                // Check if class contains signature prefixes
                var isSafe = 
                    tagName === 'video' || 
                    tagName === 'iframe' ||
                    className.indexOf('jw-') > -1 ||
                    className.indexOf('art-') > -1 ||
                    className.indexOf('vjs-') > -1 ||
                    className.indexOf('plyr') > -1 ||
                    el.closest('.jw-controls') || 
                    el.closest('.art-video-player') ||
                    el.closest('.video-js') ||
                    el.closest('.plyr');

                if (!isSafe) {
                    isOverlay = true;
                    // Debug: Log what blocked it to help troubleshooting
                    console.warn("[FlashPlay Guard] Overlay detected on:", tagName, className);
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
        
        // C. GLOBAL LINK BLOCKER: Block ALL external navigation
        var a = target.closest ? target.closest('a') : null;
        if (a) {
            var href = a.getAttribute('href') || '';
            
            // Allow only internal helper links (hash) or javascript:void(0)
            if (href.startsWith('#') || href === 'javascript:void(0)' || href === 'javascript:;') {
                // Safe
            } else {
                // BLOCK EVERYTHING ELSE
                e.preventDefault();
                e.stopPropagation();
                console.warn("[FlashPlay Guard] 🚫 Blocked external navigation:", href);
                return false;
            }
        }
    }, true);

    // ====== 3.5 Block Form Submissions ======
    document.addEventListener('submit', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.warn("[FlashPlay Guard] 🚫 Blocked form submission");
        return false;
    }, true);
    
    // ====== 3.6 Block MouseDown/PointerDown (common for popups) on non-interactive elements ======
    const blockPointer = function(e) {
        var target = e.target;
        // If clicking on something that isn't a video control or safe element
        if (target.tagName !== 'VIDEO' && !target.closest('.jw-') && !target.closest('.vjs-')) {
             // If it's an overlay or unknown div, prevent default (stops focus/window.open)
             // But be careful not to break Play button
        }
    };
    // document.addEventListener('mousedown', blockPointer, true); 
    
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
    
    // ====== 10. NEW: MutationObserver for dynamic iframes & cleanups ======
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1) { // ELEMENT_NODE
                    // A. Check if it's an iframe
                    if (node.tagName === 'IFRAME') {
                        console.log("[FlashPlay Guard] 🛡️ Sandboxing new iframe:", node.src);
                        
                        // ENFORCE SANDBOX: No allow-popups, No allow-top-navigation
                        // This natively tells the browser to block new windows from this iframe
                        try {
                            node.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
                        } catch(e) {
                            console.error("Could not sandbox iframe:", e);
                        }

                        // Try to patch the new window if possible (same-origin only)
                        try {
                            if (node.contentWindow) {
                                node.contentWindow.open = function() { return fakeWindow; };
                            }
                        } catch(e) {}
                    }
                    
                    // B. Check for suspicious overlays
                    const style = window.getComputedStyle(node);
                    if ((style.position === 'fixed' || style.position === 'absolute') && style.zIndex > 100) {
                         // Double check it's not a valid player control
                         if (!node.classList.contains('jw-') && node.tagName !== 'VIDEO') {
                             // console.warn("[FlashPlay Guard] 🛡️ Removed dynamic overlay");
                             // node.remove(); 
                             // Commented out removal for now as it might be too aggressive for legitimate controls
                             // Instead, we rely on the click blocker
                         }
                    }
                }
            });
        });
    });
    
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    console.log("[FlashPlay Guard] ✅ All protections initialized (v2.1 - Recursive)");
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': new URL(targetUrl).origin + '/',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            redirect: 'follow'
        });
        
        if (!response.ok) {
            // FAILOVER: If Vercel is blocked (403/401) or excessive rate limit (429/503), 
            // redirect user directly to the source.
            // This bypasses the Vercel IP block, though ads won't be blocked.
            if ([403, 401, 429, 503].includes(response.status)) {
                console.warn(`[Embed Proxy] Blocked by upstream (${response.status}). Redirecting to direct URL: ${targetUrl}`);
                return res.redirect(targetUrl);
            }
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
                    // CRITICAL FIX: If it's an IFRAME, use the recursive embed proxy (to inject guard script)
                    // If it's an asset (image, script, video), use the asset proxy
                    const isIframe = el.tagName === 'IFRAME' || attr === 'data-src'; 
                    // Note: some sites use data-src on iframes via lazy load
                    
                    if (isIframe && attr !== 'poster') {
                         const nsParam = req.query.ns === '1' ? '&ns=1' : '';
                         el.setAttribute(attr, `/api/embed?url=${encodeURIComponent(absUrl)}${nsParam}`);
                         
                         // Only enforce sandbox if NOT disabled via ns=1 param
                         // Some providers (vidlink, vidsrc) break if internal frames are sandboxed
                         if (req.query.ns !== '1') {
                             el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-presentation');
                         } else {
                             // If no sandbox, we rely purely on the GUARD_SCRIPT injected inside
                             el.removeAttribute('sandbox');
                         }
                    } else {
                         el.setAttribute(attr, `/api/embed/asset?url=${encodeURIComponent(absUrl)}`);
                    }
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
            "base-uri 'self'",
            "form-action 'none'",     // NEW: BLOCK FORM SUBMISSIONS
            "upgrade-insecure-requests"
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

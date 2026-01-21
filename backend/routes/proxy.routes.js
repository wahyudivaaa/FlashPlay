const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

/**
 * GET /api/proxy/vidlink
 * Proxies VidLink player and injects Aggressive AdBlock
 */
router.get('/embed', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send('Missing url parameter');
    }

    try {
        console.log(`[Proxy] Fetching: ${url}`);
        
        // 1. Fetch the original page
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://vidsrc.vip/' 
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        let html = await response.text();
        const baseUrl = new URL(url).origin;

        // 2. Inject AdBlock Script (The "Anti-Popup Nuke")
        // We inject this at the VERY TOP of <head> so it runs before any other script.
        const adBlockScript = `
            <script>
                (function() {
                    console.log("[FlashPlay Proxy] 🛡️ Aggressive AdBlock Activated!");
                    
                    // 1. Freeze window.open
                    const fakeWindow = {
                        close: () => {},
                        focus: () => {},
                        blur: () => {},
                        postMessage: () => {},
                        document: { write: () => {}, open: () => {}, close: () => {} },
                        location: { href: 'about:blank' },
                        closed: false
                    };
                    Object.freeze(fakeWindow);

                    Object.defineProperty(window, 'open', {
                        configurable: false,
                        writable: false,
                        value: function(url) {
                            console.log("[FlashPlay Proxy] 🚫 Blocked Popup:", url);
                            return fakeWindow;
                        }
                    });

                    // 2. Mock 'sandbox' check
                    // VidLink checks if it can escape. We let it "think" it isn't sandboxed
                    // But since we killed window.open, it can't escape anyway.
                    
                    // 3. Block Redirects
                    window.onbeforeunload = function() { return false; };
                    
                    // 4. Kill click listeners periodically
                    // This clears 'click' events added by Ad scripts
                    /*
                    setInterval(() => {
                        // We can't easily clear listeners without wrapper, 
                        // but we can intercept them at capture phase
                    }, 1000);
                    */
                   
                   // 5. Intercept Click
                   window.addEventListener('click', function(e) {
                       // If targeting new tab, block it
                       if (e.target.target === '_blank') {
                           e.preventDefault();
                           e.stopPropagation();
                           console.log("[FlashPlay Proxy] 🚫 Blocked Link Click");
                       }
                   }, true);

                })();
            </script>
            <base href="${baseUrl}/"> 
        `;
        // Note: <base> tag fixes relative paths (css/js/images)

        // Insert after <head>
        html = html.replace('<head>', `<head>${adBlockScript}`);
        
        // Remove CSP headers that might block our script
        res.removeHeader('Content-Security-Policy');
        res.removeHeader('X-Frame-Options');
        
        // SET CONTENT TYPE - Critical for iframe rendering!
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Serve modified HTML
        res.send(html);

    } catch (error) {
        console.error('[Proxy] Error:', error);
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
});

module.exports = router;

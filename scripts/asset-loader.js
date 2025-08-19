// PokeSnipe Extension - External Asset Loader
// This module handles loading CSS and HTML from GitHub

class AssetLoader {
    constructor() {
        this.config = null;
        this.cache = new Map();
        this.retryAttempts = 3;
        this.retryDelay = 1000;
    }

    // Load configuration from GitHub or use embedded fallback
    async loadConfig(configUrl) {
        try {
            const response = await fetch(configUrl);
            if (response.ok) {
                this.config = await response.json();
                console.log('✅ External asset config loaded');
                return this.config;
            }
        } catch (error) {
            console.warn('⚠️ Failed to load external config, using defaults:', error);
        }

        // Fallback configuration
        this.config = {
            version: "1.0.0",
            assets: {
                css: {
                    popup: {
                        github_raw: "https://raw.githubusercontent.com/pokessniper/pokesnipe-assets/main/styles/popup.css",
                        fallback: "inline"
                    }
                }
            },
            cdn_config: {
                primary_host: "github_raw",
                cache_duration: 300000,
                retry_attempts: 3,
                retry_delay: 1000
            }
        };
        return this.config;
    }

    // Load CSS with fallback support
    async loadCSS(assetName) {
        if (!this.config) {
            throw new Error('Config not loaded. Call loadConfig() first.');
        }

        const cssConfig = this.config.assets.css[assetName];
        if (!cssConfig) {
            throw new Error(`CSS asset '${assetName}' not found in config`);
        }

        // Check cache first
        const cacheKey = `css_${assetName}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.config.cdn_config.cache_duration) {
                console.log(`� Using cached CSS: ${assetName}`);
                return cached.content;
            }
        }

        // Try to load from primary source
        const primaryUrl = cssConfig.github_raw || cssConfig.github_pages;
        let cssContent = await this.fetchWithRetry(primaryUrl);

        if (!cssContent && cssConfig.github_pages && cssConfig.github_raw) {
            // Try fallback URL
            const fallbackUrl = cssConfig.github_pages === primaryUrl ? cssConfig.github_raw : cssConfig.github_pages;
            console.log('� Trying fallback URL for CSS');
            cssContent = await this.fetchWithRetry(fallbackUrl);
        }

        if (cssContent) {
            // Cache the content
            this.cache.set(cacheKey, {
                content: cssContent,
                timestamp: Date.now()
            });
            console.log(`✅ External CSS loaded: ${assetName}`);
            return cssContent;
        }

        throw new Error(`Failed to load CSS: ${assetName}`);
    }

    // Apply CSS to the document
    applyCSS(cssContent, styleId = 'external-styles') {
        // Remove existing external styles
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create and inject new styles
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = cssContent;
        document.head.appendChild(styleElement);
        
        console.log(`✅ CSS applied with ID: ${styleId}`);
    }

    // Load CSS via link element (alternative method)
    loadCSSLink(url, linkId = 'external-css-link') {
        return new Promise((resolve, reject) => {
            // Remove existing link
            const existingLink = document.getElementById(linkId);
            if (existingLink) {
                existingLink.remove();
            }

            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = url;
            
            link.onload = () => {
                console.log(`✅ CSS link loaded: ${url}`);
                resolve();
            };
            
            link.onerror = () => {
                console.error(`❌ CSS link failed: ${url}`);
                reject(new Error(`Failed to load CSS from ${url}`));
            };

            document.head.appendChild(link);
        });
    }

    // Fetch with retry logic
    async fetchWithRetry(url, attempts = null) {
        const maxAttempts = attempts || this.config?.cdn_config?.retry_attempts || this.retryAttempts;
        const delay = this.config?.cdn_config?.retry_delay || this.retryDelay;

        for (let i = 0; i < maxAttempts; i++) {
            try {
                console.log(`� Fetching (attempt ${i + 1}/${maxAttempts}): ${url}`);
                const response = await fetch(url);
                
                if (response.ok) {
                    return await response.text();
                } else {
                    console.warn(`⚠️ HTTP ${response.status} for ${url}`);
                }
            } catch (error) {
                console.warn(`⚠️ Fetch error (attempt ${i + 1}): ${error.message}`);
            }

            // Wait before retry (except on last attempt)
            if (i < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
            }
        }

        return null;
    }

    // Check if assets need updating
    async checkForUpdates() {
        if (!this.config) return false;

        try {
            const configUrl = this.config.update_check_url;
            if (!configUrl) return false;

            const response = await fetch(configUrl);
            if (response.ok) {
                const latestConfig = await response.json();
                return latestConfig.version !== this.config.version;
            }
        } catch (error) {
            console.warn('Update check failed:', error);
        }

        return false;
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        console.log('�️ Asset cache cleared');
    }

    // Get cache info
    getCacheInfo() {
        const info = Array.from(this.cache.entries()).map(([key, value]) => ({
            key,
            size: value.content.length,
            age: Date.now() - value.timestamp
        }));
        return info;
    }
}

// Export for use in popup.js
window.AssetLoader = AssetLoader;

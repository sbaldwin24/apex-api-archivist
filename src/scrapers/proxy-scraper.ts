import { HttpsProxyAgent } from 'https-proxy-agent';
import { getRandomProxy } from '../proxy/oxylabs-config';

interface ProxyConfig {
  username: string;
  password: string;
  enabled: boolean;
}

export class ProxyScraper {
  private proxyConfig: ProxyConfig;

  constructor(config: ProxyConfig) {
    this.proxyConfig = config;
  }

  async fetchWithProxy(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.proxyConfig.enabled) {
      return fetch(url, options);
    }

    const proxy = getRandomProxy();
    if (!proxy) {
      throw new Error('No proxy available');
    }
    
    const proxyUrl = `http://${this.proxyConfig.username}:${this.proxyConfig.password}@${proxy.host}:${proxy.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      ...options.headers
    };

    return fetch(url, {
      ...options,
      headers,
      // @ts-ignore
      agent
    });
  }

  async scrapeWithRetry(url: string, maxRetries: number = 3): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}: Scraping ${url}`);
        
        const response = await this.fetchWithProxy(url);
        
        if (response.ok) {
          return await response.text();
        }
        
        if (response.status === 403 || response.status === 429) {
          console.log(`Rate limited (${response.status}), retrying with different proxy...`);
          
          await this.delay(2000 * attempt);
         
          continue;
        }
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        await this.delay(1000 * attempt);
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

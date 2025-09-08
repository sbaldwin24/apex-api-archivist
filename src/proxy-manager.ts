import { readFileSync } from 'node:fs';

interface ProxyConfig {
	server: string;
	username?: string;
	password?: string;
}

export class ProxyManager {
	private proxies: ProxyConfig[] = [];
	private currentIndex = 0;
	private static readonly PROXY_SERVER = 'us-ca.proxymesh.com:31280';
	private static readonly LOCAL_NETWORK = '192.168.0.0';

	constructor() {
		this.loadProxies();
	}

	private loadProxies() {
		/** Add Oxylabs proxy first */
		this.proxies.push({
			password: 'Unfocused5~Dimly~Coeditor~Unpleased',
			server: 'dc.oxylabs.io:8000',
			username: 'user-headwear5894_SXS19-country-US'
		});

		try {
			const content = readFileSync('proxies.txt', 'utf-8');
			const lines = content
				.split('\n')
				.filter((line) => line.trim() && !line.startsWith('#'));

			const fileProxies = lines.map((line) => {
				const trimmed = line.trim();

				/** Handle URL format (http://user:pass@host:port) */
				if (trimmed.startsWith('http')) {
					const url = new URL(trimmed);
					const config: ProxyConfig = {
						server: `${url.hostname}:${url.port}`
					};
					if (url.username) config.username = url.username;
					if (url.password) config.password = url.password;
					return config;
				}

				/** Handle IP:port format */
				return { server: trimmed };
			});

			this.proxies.push(...fileProxies);

			console.log(`Loaded ${this.proxies.length} proxies (including Oxylabs)`);
		} catch (error) {
			console.error(
				`No proxy file found, using Oxylabs and default: ${error} -> ${ProxyManager.PROXY_SERVER}`
			);

			this.proxies.push({ server: ProxyManager.PROXY_SERVER });
		}
	}

	getNext(): ProxyConfig | null {
		if (this.proxies.length === 0) return null;

		const proxy = this.proxies[this.currentIndex] ?? null;
		this.currentIndex = (this.currentIndex + 1) % this.proxies.length;

		return proxy;
	}

	static isInLocalNetwork(host: string): boolean {
		/** Simple check to see if the host is in the local network */
		return host.startsWith(ProxyManager.LOCAL_NETWORK);
	}
}

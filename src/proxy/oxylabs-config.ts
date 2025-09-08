export const OXYLABS_DATACENTER_PROXIES = [
  {
    host: 'dc.oxylabs.io',
    port: 8001,
    ip: '93.115.200.159'
  },
  {
    host: 'dc.oxylabs.io', 
    port: 8002,
    ip: '93.115.200.158'
  },
  {
    host: 'dc.oxylabs.io',
    port: 8003, 
    ip: '93.115.200.157'
  },
  {
    host: 'dc.oxylabs.io',
    port: 8004,
    ip: '93.115.200.156'
  },
  {
    host: 'dc.oxylabs.io',
    port: 8005,
    ip: '93.115.200.155'
  }
];

export function getRandomProxy() {
  return OXYLABS_DATACENTER_PROXIES[Math.floor(Math.random() * OXYLABS_DATACENTER_PROXIES.length)];
}

export function createProxyAgent(username: string, password: string) {
  const proxy = getRandomProxy();
  
  if (!proxy) {
    throw new Error('No proxy available');
  }
  
  return {
    host: proxy.host,
    port: proxy.port,
    auth: `${username}:${password}`,
    protocol: 'http'
  };
}

import { load } from 'cheerio';
import Crawl4AI from 'crawl4ai';

export async function discoverAllDrivers(year: number): Promise<string[]> {
	const driverUrls: string[] = [];

	try {
		const client = new Crawl4AI({
			baseUrl: 'http://localhost:11235'
		});

		/** Scrape driver list from standings page */
		const standingsUrl = `https://www.racing-reference.info/standings/${year}/W/`;
		const results = await client.crawl({
			browser_config: {
				headless: true,
				user_agent:
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			urls: [standingsUrl]
		});

		if (!results || results.length === 0 || !results[0]?.success) {
			throw new Error('Failed to fetch standings page');
		}

		const $ = load(results[0]?.html || '');

		/** Find all driver links in standings table */
		$('a[href*="/driver/"]').each((_, element) => {
			const href = $(element).attr('href');

			if (href && href.includes('/driver/')) {
				const fullUrl = href.startsWith('http')
					? href
					: `https://www.racing-reference.info${href}`;

				if (!driverUrls.includes(fullUrl)) {
					driverUrls.push(fullUrl);
				}
			}
		});

		console.log(
			`Discovered ${driverUrls.length} drivers from ${year} standings`
		);

		return driverUrls;
	} catch (error: any) {
		console.error(`Driver discovery failed: ${error.message}`);

		return [];
	}
}

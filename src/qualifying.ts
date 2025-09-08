import { load } from 'cheerio';
import Crawl4AI from 'crawl4ai';

interface QualifyingResult {
	driverName: string;
	carNumber: string;
	teamName: string;
	qualifyingPosition: number;
	qualifyingSpeed?: number | undefined;
	qualifyingTime?: string | undefined;
}

interface QualifyingData {
	eventId: string;
	results: QualifyingResult[];
}

export async function scrapeQualifying(
	qualifyingUrl: string
): Promise<QualifyingData | null> {
	try {
		const client = new Crawl4AI({
			baseUrl: 'http://localhost:11235'
		});

		const results = await client.crawl({
			browser_config: {
				headless: true,
				user_agent:
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			urls: [qualifyingUrl]
		});

		if (!results || results.length === 0 || !results[0]?.success) {
			return null;
		}

		const $ = load(results[0]?.html || '');
		const eventId = qualifyingUrl.split('/').slice(-2, -1)[0] || '';

		const qualifyingData: QualifyingData = { eventId, results: [] };

		$('table tr').each((index, element) => {
			const cells = $(element).find('td');

			if (cells.length >= 4) {
				const position = Number($(cells[0]).text().trim());
				const driverName = $(cells[1]).text().trim();
				const carNumber = $(cells[2]).text().trim();
				const teamName = $(cells[3]).text().trim();
				const speed = parseFloat($(cells[4]).text().trim()) || undefined;
				const time = $(cells[5]).text().trim() || undefined;

				if (position > 0 && driverName) {
					qualifyingData.results.push({
						carNumber,
						driverName,
						qualifyingPosition: position,
						qualifyingSpeed: speed,
						qualifyingTime: time,
						teamName
					});
				}
			}
		});

		return qualifyingData.results.length > 0 ? qualifyingData : null;
	} catch (error: any) {
		throw new Error(
			`Qualifying scrape failed for ${qualifyingUrl}: ${error.message}`
		);
	}
}

import { load } from 'cheerio';
import Crawl4AI from 'crawl4ai';

interface StageResult {
	stageNumber: number;
	driverName: string;
	stagePosition: number;
	stagePoints: number;
}

interface StageData {
	eventId: string;
	stages: StageResult[];
}

export async function scrapeStages(raceUrl: string): Promise<StageData | null> {
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
			urls: [raceUrl]
		});

		if (!results || results.length === 0 || !results[0]?.success) {
			return null;
		}

		const $ = load(results[0]?.html || '');
		const eventId = raceUrl.split('/').slice(-2, -1)[0] || '';

		const stageData: StageData = { eventId, stages: [] };

		/** Look for stage results sections */
		$('h3, h4').each((_, header) => {
			const headerText = $(header).text().toLowerCase();
			if (headerText.includes('stage')) {
				const stageMatch = headerText.match(/stage (\d+)/);

				if (stageMatch?.[1]) {
					const stageNumber = Number(stageMatch[1]);

					/** Find the table following this header */
					const table = $(header).nextAll('table').first();

					table.find('tr').each((_, row) => {
						const cells = $(row).find('td');

						if (cells.length >= 3) {
							const position = Number($(cells[0]).text().trim());
							const driverName = $(cells[1]).text().trim();
							const points = Number($(cells[2]).text().trim()) || 0;

							if (position > 0 && driverName) {
								stageData.stages.push({
									driverName,
									stageNumber,
									stagePoints: points,
									stagePosition: position
								});
							}
						}
					});
				}
			}
		});

		return stageData.stages.length > 0 ? stageData : null;
	} catch (error: any) {
		throw new Error(`Stage scrape failed for ${raceUrl}: ${error.message}`);
	}
}

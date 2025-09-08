import { load } from 'cheerio';
import Crawl4AI from 'crawl4ai';

interface StandingsEntry {
	driverName: string;
	position: number;
	points: number;
	wins: number;
	pointsBehind: number;
}

interface StandingsData {
	seasonId: string;
	raceNumber: number;
	standings: StandingsEntry[];
}

export async function scrapeStandings(
	standingsUrl: string
): Promise<StandingsData | null> {
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
			urls: [standingsUrl]
		});

		if (!results || results.length === 0 || !results[0]?.success) {
			return null;
		}

		const $ = load(results[0]?.html || '');

		/** Extract year and race number from URL */
		const urlMatch = standingsUrl.match(/standings\/(\d{4})\/W\/(\d+)/);
		const year = urlMatch?.[1] ?? '2024';
	const raceNumber = urlMatch?.[2] ? Number(urlMatch[2]) : 1;

		const standingsData: StandingsData = {
			raceNumber,
			seasonId: `nascar_cup_series_${year}`,
			standings: []
		};

		$('table tr').each((index, element) => {
			const cells = $(element).find('td');

			if (cells.length >= 5) {
				const position = Number($(cells[0]).text().trim());
				const driverName = $(cells[1]).text().trim();
				const points = Number($(cells[2]).text().trim());
				const wins = Number($(cells[3]).text().trim()) || 0;
				const behind = Number($(cells[4]).text().trim()) || 0;

				if (position > 0 && driverName && points > 0) {
					standingsData.standings.push({
						driverName,
						points,
						pointsBehind: behind,
						position,
						wins
					});
				}
			}
		});

		return standingsData.standings.length > 0 ? standingsData : null;
	} catch (error: any) {
		throw new Error(
			`Standings scrape failed for ${standingsUrl}: ${error.message}`
		);
	}
}

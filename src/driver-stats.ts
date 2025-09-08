import { load } from 'cheerio';
import Crawl4AI from 'crawl4ai';

interface DriverStats {
	driverId: string;
	firstName: string;
	lastName: string;
	careerWins: number;
	careerPoles: number;
	careerTop5s: number;
	careerTop10s: number;
	careerStarts: number;
	championships: number;
	dateOfBirth?: string;
	hometown?: string;
}

export async function scrapeDriverStats(
	driverUrl: string
): Promise<DriverStats | null> {
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
			urls: [driverUrl]
		});

		if (!results || results.length === 0 || !results[0]?.success) {
			return null;
		}

		const $ = load(results[0]?.html || '');

		const nameText = $('h1').first().text().trim();
		const [firstName, ...lastNameParts] = nameText.split(' ');
		const lastName = lastNameParts.join(' ');

		const driverId = driverUrl.split('/').pop()?.replace('.html', '') || '';

		/** Parse stats from the stats table */
		const stats: DriverStats = {
			careerPoles: 0,
			careerStarts: 0,
			careerTop5s: 0,
			careerTop10s: 0,
			careerWins: 0,
			championships: 0,
			driverId,
			firstName: firstName || '',
			lastName: lastName || nameText
		};

		/** Look for stats in various table formats */
		$('table tr').each((_, row) => {
			const cells = $(row).find('td');

			if (cells.length >= 2) {
				const label = $(cells[0]).text().trim().toLowerCase();
				const value = Number($(cells[1]).text().trim()) || 0;

				if (label.includes('wins')) stats.careerWins = value;
				else if (label.includes('poles')) stats.careerPoles = value;
				else if (label.includes('top 5')) stats.careerTop5s = value;
				else if (label.includes('top 10')) stats.careerTop10s = value;
				else if (label.includes('starts')) stats.careerStarts = value;
				else if (label.includes('championships')) stats.championships = value;
			}
		});

		return stats;
	} catch (error: any) {
		throw new Error(
			`Driver stats scrape failed for ${driverUrl}: ${error.message}`
		);
	}
}

export async function saveDriverStats(stats: DriverStats): Promise<void> {
	/** This would integrate with your database module */
	console.log(`Saving driver stats for ${stats.firstName} ${stats.lastName}`);
}

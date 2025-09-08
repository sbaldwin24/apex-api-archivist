import { load } from 'cheerio';
import Crawl4AI from 'crawl4ai';

interface HistoricalRace {
	year: number;
	raceName: string;
	winner: string;
	trackName: string;
	raceUrl: string;
}

export async function discoverHistoricalRaces(
	trackName: string,
	currentYear: number,
	yearsBack: number = 5
): Promise<string[]> {
	const raceUrls: string[] = [];

	try {
		const client = new Crawl4AI({
			baseUrl: 'http://localhost:11235'
		});

		/** Search for track page first */
		const trackSearchUrl = `https://www.racing-reference.info/tracks/`;
		const results = await client.crawl({
			browser_config: {
				headless: true,
				user_agent:
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			urls: [trackSearchUrl]
		});

		if (!results || results.length === 0 || !results[0]?.success) {
			throw new Error('Failed to fetch tracks page');
		}

		const $ = load(results[0]?.html || '');

		/** Find track link that matches the track name */
		let trackUrl = '';

		$('a[href*="/tracks/"]').each((_, element): void | false => {
			const text = $(element).text().trim();
			if (text.toLowerCase().includes(trackName.toLowerCase())) {
				const href = $(element).attr('href');
				if (href) {
					trackUrl = href.startsWith('http')
						? href
						: `https://www.racing-reference.info${href}`;

					return false;
				}
			}
		});

		if (!trackUrl) {
			console.warn(`Track not found: ${trackName}`);
			return [];
		}

		/** Get historical races for this track */
		const trackResults = await client.crawl({
			browser_config: {
				headless: true,
				user_agent:
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			urls: [trackUrl]
		});

		if (
			!trackResults ||
			trackResults.length === 0 ||
			!trackResults[0]?.success
		) {
			throw new Error('Failed to fetch track page');
		}

		const trackPage = load(trackResults[0]?.html || '');

		/** Find race links for previous years */
		trackPage('a[href*="/race-results/"]').each((_, element) => {
			const href = trackPage(element).attr('href');

			if (href) {
				const yearMatch = href.match(/\/race-results\/(\d{4})-/);

				if (yearMatch?.[1]) {
					const year = Number(yearMatch[1]);

					if (year >= currentYear - yearsBack && year < currentYear) {
						const fullUrl = href.startsWith('http')
							? href
							: `https://www.racing-reference.info${href}`;

						if (!raceUrls.includes(fullUrl)) {
							raceUrls.push(fullUrl);
						}
					}
				}
			}
		});

		console.log(`Found ${raceUrls.length} historical races for ${trackName}`);

		return raceUrls;
	} catch (error: any) {
		console.error(
			`Historical data discovery failed for ${trackName}: ${error.message}`
		);

		return [];
	}
}

export async function getTracksFromCurrentSeason(
	year: number
): Promise<string[]> {
	const tracks: string[] = [];

	try {
		const client = new Crawl4AI({
			baseUrl: 'http://localhost:11235'
		});

		/** Get schedule page to find all tracks for the year */
		const scheduleUrl = `https://www.racing-reference.info/season/${year}/W/`;
		const results = await client.crawl({
			browser_config: {
				headless: true,
				user_agent:
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			urls: [scheduleUrl]
		});

		if (!results || results.length === 0 || !results[0]?.success) {
			return tracks;
		}

		const $ = load(results[0]?.html || '');

		/** Extract track names from schedule */
		$('a[href*="/tracks/"]').each((_, element) => {
			const trackName = $(element).text().trim();

			if (trackName && !tracks.includes(trackName)) {
				tracks.push(trackName);
			}
		});
	} catch (error: any) {
		console.error(`Failed to get tracks for ${year}: ${error.message}`);

		return [];
	}

	return tracks;
}

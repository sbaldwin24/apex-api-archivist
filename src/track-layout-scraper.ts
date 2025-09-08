import * as cheerio from 'cheerio';
import { pool } from './database';

interface TrackLayout {
	trackId: string;
	trackName: string;
	mapImageUrl: string;
	layoutSvg?: string;
	turns: TurnData[];
	banking: BankingData;
	dimensions: TrackDimensions;
}

interface TurnData {
	number: number;
	name: string;
	banking: number;
	radius: number;
	speed: number;
	coordinates: { x: number; y: number };
}

interface BankingData {
	turns: number;
	frontstretch: number;
	backstretch: number;
}

interface TrackDimensions {
	length: number;
	width: number;
	shape: string;
}

const headers = {
	'User-Agent':
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

export async function scrapeTrackLayouts(): Promise<void> {
	const tracks = [
		'daytona-international-speedway',
		'talladega-superspeedway',
		'charlotte-motor-speedway',
		'las-vegas-motor-speedway',
		'phoenix-raceway',
		'atlanta-motor-speedway',
		'homestead-miami-speedway',
		'texas-motor-speedway',
		'kansas-speedway',
		'chicagoland-speedway'
	];

	for (const trackSlug of tracks) {
		console.log(`Scraping layout for: ${trackSlug}`);

		await scrapeTrackLayout(trackSlug);
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
}

async function scrapeTrackLayout(trackSlug: string): Promise<void> {
	try {
		const urls = [
			`https://www.nascar.com/tracks/${trackSlug}/`,
			`https://en.wikipedia.org/wiki/${trackSlug.replace(/-/g, '_')}`,
			`https://www.racing-reference.info/tracks/${trackSlug}/`
		];

		let layout: TrackLayout | null = null;

		for (const url of urls) {
			try {
				layout = await scrapeTrackPage(url, trackSlug);

				if (layout) break;
			} catch (error) {
				console.log(`Failed to scrape ${url} --> ${error}`);
			}
		}

		await (layout ? saveTrackLayout(layout) : generateTrackLayout(trackSlug));
	} catch (error) {
		console.error(`Error scraping track layout for ${trackSlug}:`, error);
	}
}

/**
 * @description Scrapes a track page and extracts the track layout
 *
 * @param {string} url
 * @param {string} trackSlug
 * @return {*}  {(Promise<TrackLayout | null>)}
 */
async function scrapeTrackPage(
	url: string,
	trackSlug: string
): Promise<TrackLayout | null> {
	const response = await fetch(url, { headers });
	const html = await response.text();
	const $ = cheerio.load(html);

	/** Extract track map image */
	const mapImage =
		$('.track-map img, .track-layout img, .infobox img').first().attr('src') ||
		$('img[alt*="track"], img[alt*="layout"], img[alt*="map"]')
			.first()
			.attr('src');

	/** Extract track specifications */
	const trackName =
		$('.track-name, h1, .page-title').first().text().trim() ||
		trackSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

	/** Parse banking information */
	const bankingText = $('body').text();
	const turnBanking = extractBanking(bankingText, 'turn');
	const frontstretchBanking = extractBanking(bankingText, 'frontstretch');

	/** Generate turn data based on track type */
	const turns = generateTurnData(trackSlug, turnBanking);

	return {
		banking: {
			backstretch: frontstretchBanking * 0.5,
			frontstretch: frontstretchBanking,
			turns: turnBanking
		},
		dimensions: getTrackDimensions(trackSlug),
		mapImageUrl: mapImage ? new URL(mapImage, url).href : '',
		trackId: trackSlug,
		trackName,
		turns
	};
}

/**
 * @description Extracts the banking information from the text
 *
 * @param {string} text
 * @param {string} section
 * @return {*}  {number}
 */
function extractBanking(text: string, section: string): number {
	const patterns = [
		new RegExp(`${section}[^\\d]*([\\d.]+)\\s*degree`, 'i'),
		new RegExp(`${section}[^\\d]*([\\d.]+)°`, 'i'),
		/banking[^\d]*([\d.]+)/i
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);

		if (match?.[1]) {
			return parseFloat(match[1]);
		} else {
			console.log(`No match found for ${section} in ${text}`);
		}
	}

	/** Default banking values */
	const defaults: { [key: string]: number } = {
		'charlotte-motor-speedway': 24,
		'daytona-international-speedway': 31,
		'las-vegas-motor-speedway': 20,
		'phoenix-raceway': 11,
		'talladega-superspeedway': 33
	};

	return defaults[section] || 15;
}

function generateTurnData(trackSlug: string, banking: number): TurnData[] {
	const trackConfigs: { [key: string]: any } = {
		'charlotte-motor-speedway': {
			shape: 'quad-oval',
			turns: [
				{
					banking: 24,
					coordinates: { x: -150, y: -100 },
					name: 'Turn 1',
					number: 1,
					radius: 800,
					speed: 165
				},
				{
					banking: 24,
					coordinates: { x: -100, y: -120 },
					name: 'Turn 2',
					number: 2,
					radius: 800,
					speed: 170
				},
				{
					banking: 24,
					coordinates: { x: 100, y: 120 },
					name: 'Turn 3',
					number: 3,
					radius: 800,
					speed: 165
				},
				{
					banking: 24,
					coordinates: { x: 150, y: 100 },
					name: 'Turn 4',
					number: 4,
					radius: 800,
					speed: 170
				}
			]
		},
		'daytona-international-speedway': {
			shape: 'tri-oval',
			turns: [
				{
					banking: 31,
					coordinates: { x: -180, y: -80 },
					name: 'Turn 1',
					number: 1,
					radius: 1000,
					speed: 185
				},
				{
					banking: 31,
					coordinates: { x: -120, y: -100 },
					name: 'Turn 2',
					number: 2,
					radius: 1000,
					speed: 190
				},
				{
					banking: 31,
					coordinates: { x: 120, y: 100 },
					name: 'Turn 3',
					number: 3,
					radius: 1000,
					speed: 185
				},
				{
					banking: 31,
					coordinates: { x: 180, y: 80 },
					name: 'Turn 4',
					number: 4,
					radius: 1000,
					speed: 190
				}
			]
		}
	};

	const config = trackConfigs[trackSlug];
	if (config) {
		return config.turns;
	}

	/** Default 4-turn oval */
	return [
		{
			banking,
			coordinates: { x: -150, y: -100 },
			name: 'Turn 1',
			number: 1,
			radius: 800,
			speed: 160
		},
		{
			banking,
			coordinates: { x: -100, y: -120 },
			name: 'Turn 2',
			number: 2,
			radius: 800,
			speed: 165
		},
		{
			banking,
			coordinates: { x: 100, y: 120 },
			name: 'Turn 3',
			number: 3,
			radius: 800,
			speed: 160
		},
		{
			banking,
			coordinates: { x: 150, y: 100 },
			name: 'Turn 4',
			number: 4,
			radius: 800,
			speed: 165
		}
	];
}

/**
 * @description Gets the track dimensions
 *
 * @param {string} trackSlug
 * @return {*}  {TrackDimensions}
 */
function getTrackDimensions(trackSlug: string): TrackDimensions {
	const dimensions: { [key: string]: TrackDimensions } = {
		'charlotte-motor-speedway': { length: 1.5, shape: 'quad-oval', width: 40 },
		'daytona-international-speedway': {
			length: 2.5,
			shape: 'tri-oval',
			width: 40
		},
		'las-vegas-motor-speedway': {
			length: 1.5,
			shape: 'intermediate',
			width: 40
		},
		'phoenix-raceway': { length: 1.0, shape: 'short-track', width: 40 },
		'talladega-superspeedway': { length: 2.66, shape: 'tri-oval', width: 40 }
	};

	return dimensions[trackSlug] || { length: 1.5, shape: 'oval', width: 40 };
}

/**
 * @description Generates a track layout
 *
 * @param {string} trackSlug
 * @return {*}  {Promise<void>}
 */
async function generateTrackLayout(trackSlug: string): Promise<void> {
	console.log(`Generating layout for: ${trackSlug}`);

	const layout: TrackLayout = {
		banking: { backstretch: 5, frontstretch: 10, turns: 20 },
		dimensions: getTrackDimensions(trackSlug),
		mapImageUrl: `/images/tracks/${trackSlug}.svg`,
		trackId: trackSlug,
		trackName: trackSlug
			.replace(/-/g, ' ')
			.replace(/\b\w/g, (l) => l.toUpperCase()),
		turns: generateTurnData(trackSlug, 20)
	};

	await saveTrackLayout(layout);
}

/**
 * @description Saves a track layout
 *
 * @param {TrackLayout} layout
 * @return {*}  {Promise<void>}
 */
async function saveTrackLayout(layout: TrackLayout): Promise<void> {
	const client = await pool.connect();

	try {
		await client.query(
			`
      INSERT INTO track_layouts 
      (track_id, track_name, map_image_url, layout_svg, turns_data, banking_data, dimensions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (track_id)
      DO UPDATE SET 
        track_name = $2,
        map_image_url = $3,
        layout_svg = $4,
        turns_data = $5,
        banking_data = $6,
        dimensions = $7
    `,
			[
				layout.trackId,
				layout.trackName,
				layout.mapImageUrl,
				layout.layoutSvg,
				JSON.stringify(layout.turns),
				JSON.stringify(layout.banking),
				JSON.stringify(layout.dimensions)
			]
		);

		console.log(`Saved layout for: ${layout.trackName}`);
	} catch (error) {
		console.error('Error saving track layout:', error);
	} finally {
		client.release();
	}
}

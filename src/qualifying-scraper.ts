import * as cheerio from 'cheerio';
import { pool } from './database';

interface QualifyingResult {
	position: number;
	driverName: string;
	carNumber: string;
	time: string;
	speed: number;
	round: string;
}

const headers = {
	Accept:
		'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
	'Accept-Encoding': 'gzip, deflate, br',
	'Accept-Language': 'en-US,en;q=0.5',
	Connection: 'keep-alive',
	'Upgrade-Insecure-Requests': '1',
	'User-Agent':
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

export async function scrapeRacingReferenceQualifying(
	year: number,
	raceNumber: number
): Promise<void> {
	try {
		const url = `https://www.racing-reference.info/race-results/${year}-${raceNumber.toString().padStart(2, '0')}/W`;
		console.log(`Scraping Racing Reference: ${url}`);

		const response = await fetch(url, { headers });
		const html = await response.text();
		const $ = cheerio.load(html);

		const results: QualifyingResult[] = [];

		/** Racing Reference main results table (includes starting positions) */
		$('table tr').each((i, row) => {
			if (i === 0) return; // Skip header

			const $row = $(row);
			const cells = $row.find('td');

			if (cells.length >= 6) {
				const finishPos = Number($(cells[0]).text().trim());
				const startPos = Number($(cells[1]).text().trim());
				const carNumber = $(cells[2]).text().trim();
				const driverName =
					$(cells[3]).find('a').text().trim() || $(cells[3]).text().trim();

				if (startPos && carNumber && driverName && startPos <= 40) {
					results.push({
						carNumber,
						driverName: cleanDriverName(driverName),
						position: startPos,
						round: 'Final',
						speed: 0,
						time: ''
					});
				}
			}
		});

		if (results.length > 0) {
			const eventId = `race_${year}_${raceNumber}`;

			await saveQualifyingResults(eventId, results);

			console.log(
				`Scraped ${results.length} starting positions from Racing Reference`
			);
		}
	} catch (error) {
		console.error(`Error scraping Racing Reference: ${error}`);
	}
}

export async function scrapeDriverAveragesQualifying(): Promise<void> {
	try {
		const url = 'https://www.driveraverages.com/nascar_stats/qualifying.php';
		console.log(`Scraping Driver Averages: ${url}`);

		const response = await fetch(url, { headers });
		const html = await response.text();
		const $ = cheerio.load(html);

		const results: QualifyingResult[] = [];

		/** Look for qualifying stats table */
		$('table tr').each((i, row) => {
			if (i === 0) return; // Skip header

			const $row = $(row);
			const cells = $row.find('td');

			if (cells.length >= 4) {
				const driverName = $(cells[0]).text().trim();
				const avgStart = parseFloat($(cells[1]).text().trim());
				const carNumber = $(cells[2]).text().trim() || '00';

				if (driverName && avgStart && avgStart <= 40) {
					results.push({
						carNumber,
						driverName: cleanDriverName(driverName),
						position: Math.round(avgStart),
						round: 'Average',
						speed: 0,
						time: ''
					});
				}
			}
		});

		if (results.length > 0) {
			const eventId = 'average_qualifying_2024';
			await saveQualifyingResults(eventId, results);
			console.log(`Scraped ${results.length} average qualifying positions`);
		}
	} catch (error) {
		console.error(`Error scraping Driver Averages: ${error}`);
	}
}

/** Fallback: Generate qualifying data from race results */
export async function generateQualifyingFromRaceResults(): Promise<void> {
	const client = await pool.connect();

	try {
		console.log('Generating qualifying data from race results...');

		/** Use race results to estimate starting positions */
		const raceResults = await client.query(`
      SELECT 
        rr.event_id,
        rr.driver_id,
        d.first_name || ' ' || d.last_name as driver_name,
        rr.car_number,
        rr.start_position,
        rr.finish_position,
        rr.laps_led,
        COALESCE(rr.team_id, 'unknown_team') as team_id
      FROM race_results rr
      JOIN drivers d ON rr.driver_id = d.id
      JOIN events e ON rr.event_id = e.id
      WHERE e.event_date >= '2024-01-01'
      AND rr.start_position IS NOT NULL
      AND rr.start_position > 0
      ORDER BY e.event_date DESC, rr.start_position
    `);

		console.log(
			`Found ${raceResults.rows.length} race results with starting positions`
		);

		for (const result of raceResults.rows) {
			/** Estimate qualifying speed based on performance */
			const estimatedSpeed =
				180 + (40 - result.start_position) * 2 + result.laps_led * 0.1;

			await client.query(
				`
        INSERT INTO qualifying_results 
        (event_id, driver_id, team_id, car_number, qualifying_position, qualifying_time, qualifying_speed, round, pole_winner)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (event_id, driver_id)
        DO UPDATE SET 
          car_number = $4,
          qualifying_position = $5,
          qualifying_speed = $7,
          pole_winner = $9
      `,
				[
					result.event_id,
					result.driver_id,
					result.team_id,
					result.car_number,
					result.start_position,
					'', // No time available
					estimatedSpeed,
					'Generated',
					result.start_position === 1
				]
			);
		}

		console.log('Generated qualifying data from race results');
	} catch (error) {
		console.error('Error generating qualifying data:', error);
	} finally {
		client.release();
	}
}

function cleanDriverName(name: string): string {
	return name
		.replace(/^\d+\.\s*/, '')
		.replace(/\s*\(.*\)/, '')
		.replace(/\s+/g, ' ')
		.trim();
}

async function saveQualifyingResults(
	eventId: string,
	results: QualifyingResult[]
): Promise<void> {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		for (const result of results) {
			const driverId = result.driverName
				.toLowerCase()
				.replace(/\s+/g, '_')
				.replace(/[^a-z0-9_]/g, '');

			const nameParts = result.driverName.split(' ');
			const firstName = nameParts[0] || '';
			const lastName = nameParts.slice(1).join(' ') || result.driverName;

			await client.query(
				`
        INSERT INTO drivers (id, first_name, last_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3
      `,
				[driverId, firstName, lastName]
			);

			await client.query(
				`
        INSERT INTO qualifying_results 
        (event_id, driver_id, car_number, qualifying_position, qualifying_time, qualifying_speed, round, pole_winner)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (event_id, driver_id, round)
        DO UPDATE SET 
          car_number = $3,
          qualifying_position = $4,
          qualifying_time = $5,
          qualifying_speed = $6,
          pole_winner = $8
      `,
				[
					eventId,
					driverId,
					result.carNumber,
					result.position,
					result.time,
					result.speed,
					result.round,
					result.position === 1
				]
			);
		}

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');

		throw error;
	} finally {
		client.release();
	}
}

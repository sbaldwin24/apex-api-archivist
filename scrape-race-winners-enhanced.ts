import * as cheerio from 'cheerio';
import 'dotenv/config';
import { pool } from './src/database';
import { ProxyScraper } from './src/scrapers/proxy-scraper';

const proxyScraper = new ProxyScraper({
	enabled: process.env.PROXY_ENABLED === 'true',
	password: process.env.OXYLABS_PASSWORD || '',
	username: process.env.OXYLABS_USERNAME || ''
});

interface RaceResult {
	position: number;
	driverName: string;
	carNumber: string;
	team: string;
	lapsCompleted: number;
	status: string;
	points?: number;
	earnings?: string;
}

async function scrapeRaceWinnersEnhanced() {
	console.log(
		'🏁 Starting enhanced race results scraping with Oxylabs proxies...'
	);

	const races = [
		{ name: 'daytona-500', track: 'daytona', year: 2024 },
		{ name: 'las-vegas-400', track: 'las-vegas', year: 2024 },
		{ name: 'phoenix-500', track: 'phoenix', year: 2024 },
		{ name: 'atlanta-400', track: 'atlanta', year: 2024 },
		{ name: 'cota-400', track: 'cota', year: 2024 },
		{ name: 'richmond-400', track: 'richmond', year: 2024 },
		{ name: 'martinsville-500', track: 'martinsville', year: 2024 },
		{ name: 'bristol-500', track: 'bristol', year: 2024 },
		{ name: 'talladega-500', track: 'talladega', year: 2024 },
		{ name: 'dover-400', track: 'dover', year: 2024 }
	];

	let totalResults = 0;

	for (const race of races) {
		console.log(`\n🏆 Scraping ${race.name} ${race.year}...`);

		const urls = [
			`https://www.nascar.com/results/racecenter/${race.year}/${race.name}/`,
			`https://www.racing-reference.info/race-results/${race.year}/${race.track}/`,
			`https://www.jayski.com/nascar-cup-series/${race.year}-results/${race.name}/`
		];

		for (const url of urls) {
			try {
				console.log(`📊 Trying source: ${url}`);

				const html = await proxyScraper.scrapeWithRetry(url);
				const results = extractRaceResults(html);

				if (results.length > 0) {
					await saveRaceResults(results, race);

					totalResults += results.length;

					console.log(`  ✅ Saved ${results.length} results for ${race.name}`);

					break; // Success, move to next race
				}
			} catch (error: any) {
				console.log(
					`  ⚠️ Failed source ${url}: ${error?.message || 'Unknown error'}`
				);
			}

			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	}

	console.log(
		`\n🏁 Enhanced scraping complete! Total results: ${totalResults}`
	);
	await showRaceResults();
}

function extractRaceResults(html: string): RaceResult[] {
	const $ = cheerio.load(html);
	const results: RaceResult[] = [];

	// NASCAR.com format
	$('.results-table tbody tr, .race-results-table tbody tr').each((i, row) => {
		const $row = $(row);
		const position = Number($row.find('td:first-child').text().trim()) || i + 1;
		const driverName = $row.find('.driver-name, .driver').text().trim();
		const carNumber = $row
			.find('.car-number, .number')
			.text()
			.trim()
			.replace('#', '');
		const team = $row.find('.team, .manufacturer').text().trim();
		const lapsText = $row.find('.laps, td:nth-child(6)').text().trim();
		const lapsCompleted = Number(lapsText) || 0;
		const status =
			$row.find('.status, td:last-child').text().trim() || 'Running';

		if (driverName && carNumber) {
			results.push({
				carNumber,
				driverName: cleanDriverName(driverName),
				lapsCompleted,
				position,
				status: normalizeStatus(status),
				team: cleanTeamName(team)
			});
		}
	});

	/** Racing Reference format */
	if (results.length === 0) {
		$('table tr').each((i, row) => {
			if (i === 0) return; // Skip header

			const $row = $(row);
			const cells = $row.find('td');

			if (cells.length >= 4) {
				const position = Number($(cells[0]).text().trim()) || i;
				const driverName = $(cells[1]).text().trim();
				const carNumber = $(cells[2]).text().trim().replace('#', '');
				const team = $(cells[3]).text().trim();

				if (driverName && carNumber) {
					results.push({
						carNumber,
						driverName: cleanDriverName(driverName),
						lapsCompleted: 0,
						position,
						status: 'Running',
						team: cleanTeamName(team)
					});
				}
			}
		});
	}

	return results.slice(0, 40); // Limit to top 40
}

function cleanDriverName(name: string): string {
	return name
		.replace(/^\d+\.\s*/, '') // Remove position numbers
		.replace(/\s*\(.*\)/, '') // Remove parenthetical info
		.trim();
}

function cleanTeamName(team: string): string {
	return team.replace(/Chevrolet|Ford|Toyota/gi, '').trim();
}

function normalizeStatus(status: string): string {
	const statusMap: { [key: string]: string } = {
		accident: 'Accident',
		dnf: 'DNF',
		dns: 'DNS',
		engine: 'Engine',
		running: 'Running',
		transmission: 'Transmission'
	};

	return statusMap[status.toLowerCase()] || status || 'Running';
}

async function saveRaceResults(results: RaceResult[], race: any) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		/** Create event if not exists */
		const eventId = `${race.name}_${race.year}`;
		const seasonResult = await client.query(
			`
      SELECT id FROM seasons WHERE series_id = 'nascar_cup_series' AND year = $1
    `,
			[race.year]
		);

		if (seasonResult.rows.length > 0) {
			const seasonId = seasonResult.rows[0].id;

			await client.query(
				`
        INSERT INTO events (id, season_id, track_id, name, event_date)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `,
				[
					eventId,
					seasonId,
					race.track,
					race.name.replace('-', ' '),
					`${race.year}-01-01`
				]
			);

			/** Save race results */
			for (const result of results) {
				const driverId = result.driverName
					.toLowerCase()
					.replace(/\s+/g, '_')
					.replace(/[^a-z0-9_]/g, '');

				const [firstName, ...lastNameParts] = result.driverName.split(' ');
				const lastName = lastNameParts.join(' ');

				/** Ensure driver exists */
				await client.query(
					`
          INSERT INTO drivers (id, first_name, last_name)
          VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3
        `,
					[driverId, firstName, lastName]
				);

				/** Ensure team exists */
				const teamId =
					result.team
						.toLowerCase()
						.replace(/\s+/g, '_')
						.replace(/[^a-z0-9_]/g, '') || 'unknown_team';

				await client.query(
					`
          INSERT INTO teams (id, name)
          VALUES ($1, $2)
          ON CONFLICT (id) DO UPDATE SET name = $2
        `,
					[teamId, result.team || 'Unknown Team']
				);

				/** Insert race result */
				await client.query(
					`
          INSERT INTO race_results 
          (event_id, driver_id, team_id, car_number, finish_position, laps_completed, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (event_id, driver_id) 
          DO UPDATE SET 
            finish_position = $5,
            laps_completed = $6,
            status = $7
        `,
					[
						eventId,
						driverId,
						teamId,
						result.carNumber,
						result.position,
						result.lapsCompleted,
						result.status
					]
				);
			}
		}

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

async function showRaceResults() {
	const client = await pool.connect();

	try {
		const summary = await client.query(`
      SELECT 
        COUNT(*) as total_results,
        COUNT(DISTINCT event_id) as events,
        COUNT(DISTINCT driver_id) as drivers,
        COUNT(DISTINCT team_id) as teams
      FROM race_results
      WHERE event_id LIKE '%2024%'
    `);

		console.log('\n📊 ENHANCED RACE RESULTS SUMMARY:');
		console.log(`Total 2024 results: ${summary.rows[0].total_results}`);
		console.log(`Events scraped: ${summary.rows[0].events}`);
		console.log(`Drivers: ${summary.rows[0].drivers}`);
		console.log(`Teams: ${summary.rows[0].teams}`);

		/** Show recent winners */
		const winners = await client.query(`
      SELECT 
        e.name as race_name,
        d.first_name || ' ' || d.last_name as winner,
        rr.car_number,
        t.name as team
      FROM race_results rr
      JOIN events e ON rr.event_id = e.id
      JOIN drivers d ON rr.driver_id = d.id
      JOIN teams t ON rr.team_id = t.id
      WHERE rr.finish_position = 1 AND e.id LIKE '%2024%'
      ORDER BY e.event_date DESC
      LIMIT 10
    `);

		console.log('\n🏆 RECENT RACE WINNERS:');
		winners.rows.forEach((row) => {
			console.log(
				`  ${row.race_name}: #${row.car_number} ${row.winner} (${row.team})`
			);
		});
	} finally {
		client.release();
		await pool.end();
	}
}

scrapeRaceWinnersEnhanced();

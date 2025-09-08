import * as cheerio from 'cheerio';
import { pool } from './database';

interface StageResult {
	position: number;
	driverName: string;
	points: number;
	playoffPoints: number;
	lapsLed: number;
}

interface StageData {
	stageNumber: number;
	stageName: string;
	laps: number;
	results: StageResult[];
}

export async function scrapeStageResults(
	raceUrl: string,
	eventId: string
): Promise<void> {
	try {
		const response = await fetch(raceUrl);
		const html = await response.text();
		const $ = cheerio.load(html);

		const stages: StageData[] = [];

		/** Look for stage results sections */
		$('.stage-results, .stage-winner, [data-stage]').each((i, element) => {
			const stageText = $(element)
				.find('.stage-title, .stage-header, h3')
				.text();
			const stageMatch = stageText.match(/Stage (\d+)/i);

			if (stageMatch) {
				const stageNumber = Number(stageMatch[1] || '0');
				const results: StageResult[] = [];

				/** Extract stage results table */
				$(element)
					.find('table tbody tr, .results-row')
					.each((j, row) => {
						const $row = $(row);
						const position = Number(
							$row.find('.position, td:first-child').text().trim()
						);

						const driverName = $row
							.find('.driver-name, .name, td:nth-child(2)')
							.text()
							.trim();

						const points =
							Number(
								$row.find('.points, .stage-points').text().replace(/\D/g, '')
							) || 0;

						const playoffPoints =
							Number($row.find('.playoff-points').text().replace(/\D/g, '')) ||
							0;

						const lapsLed =
							Number($row.find('.laps-led').text().replace(/\D/g, '')) || 0;

						if (position && driverName) {
							results.push({
								driverName: driverName.replace(/[^\w\s]/g, '').trim(),
								lapsLed,
								playoffPoints,
								points,
								position
							});
						}
					});

				if (results.length > 0) {
					stages.push({
						laps: 0, // Will be extracted separately if available
						results,
						stageName: `Stage ${stageNumber}`,
						stageNumber
					});
				}
			}
		});

		await saveStageResults(eventId, stages);

		console.log(`Scraped ${stages.length} stages for event ${eventId}`);
	} catch (error) {
		console.error('Error scraping stage results:', error);
	}
}

async function saveStageResults(
	eventId: string,
	stages: StageData[]
): Promise<void> {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		for (const stage of stages) {
			/** Insert stage */
			const stageResult = await client.query(
				`
        INSERT INTO stages (event_id, stage_number, stage_name, laps)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (event_id, stage_number) 
        DO UPDATE SET stage_name = $3, laps = $4
        RETURNING id
      `,
				[eventId, stage.stageNumber, stage.stageName, stage.laps]
			);

			const stageId = stageResult.rows[0].id;

			/** Insert stage results */
			for (const result of stage.results) {
				// Get or create driver
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

				/** Insert stage result */
				await client.query(
					`
          INSERT INTO stage_results (stage_id, driver_id, finish_position, points_earned, playoff_points, laps_led)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (stage_id, driver_id)
          DO UPDATE SET finish_position = $3, points_earned = $4, playoff_points = $5, laps_led = $6
        `,
					[
						stageId,
						driverId,
						result.position,
						result.points,
						result.playoffPoints,
						result.lapsLed
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

/**
 * @description Scrapes NASCAR stage results
 *
 * @param {string} raceId
 * @return {*}  {Promise<void>}
 */
export async function scrapeNASCARStageResults(raceId: string): Promise<void> {
	const url = `https://www.nascar.com/results/racecenter/${raceId}/`;

	try {
		const response = await fetch(url);
		const html = await response.text();
		const $ = cheerio.load(html);

		/** NASCAR.com specific selectors */
		const stages: StageData[] = [];

		$('.stage-results-container, .results-stage').each((i, container) => {
			const stageHeader = $(container)
				.find('.stage-header, .stage-title')
				.text();
			const stageMatch = stageHeader.match(/Stage (\d+)/i);

			if (stageMatch) {
				const stageNumber = Number(stageMatch[1] || '0');
				const results: StageResult[] = [];

				$(container)
					.find('.results-table tbody tr')
					.each((j, row) => {
						const $row = $(row);
						const position = Number($row.find('.finishing-position').text());
						const driverName = $row.find('.driver-name').text().trim();
						const points = Number($row.find('.stage-points').text()) || 0;
						const playoffPoints =
							Number($row.find('.playoff-points').text()) || 0;

						if (position && driverName) {
							results.push({
								driverName,
								lapsLed: 0,
								playoffPoints,
								points,
								position
							});
						}
					});

				stages.push({
					laps: 0,
					results,
					stageName: `Stage ${stageNumber}`,
					stageNumber
				});
			}
		});

		await saveStageResults(raceId, stages);
	} catch (error) {
		console.error('Error scraping NASCAR stage results:', error);
	}
}

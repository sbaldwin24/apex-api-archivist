import 'dotenv/config';
import pg from 'pg';

/** Apex Data API - Database Loader Module */
/** This module handles all database connections and data insertion logic. */

/** Type definition for the structured race data we receive from the scraper. */
/** This should match the interfaces in archivist.ts */
interface DriverResult {
	finishPosition: number;
	startPosition: number;
	carNumber: string;
	driverName: string;
	teamName: string;
	lapsCompleted: number;
	status: string;
	lapsLed: number;
}

interface RaceData {
	raceName: string;
	eventDate: string;
	trackName: string;
	results: DriverResult[];
}

/** Create a new connection pool. */
/** The pool will manage multiple connections and is the recommended way to interact with the DB. */
export const pool = new pg.Pool({
	database: process.env.DB_NAME,
	host: process.env.DB_HOST,
	password: process.env.DB_PASSWORD,
	port: Number(process.env.DB_PORT),
	user: process.env.DB_USER
});

/** Gets all available years with scraped data */
export async function getAvailableYears(): Promise<
	{ year: number; series_name: string; events_count: number }[]
> {
	const client = await pool.connect();

	try {
		const result = await client.query(`
			SELECT DISTINCT s.year, ser.name as series_name, COUNT(e.id) as events_count
			FROM seasons s
			JOIN series ser ON s.series_id = ser.id
			JOIN events e ON e.season_id = s.id
			GROUP BY s.year, ser.name
			ORDER BY s.year DESC, ser.name
		`);

		return result.rows;
	} finally {
		client.release();
	}
}

/**
 * Saves comprehensive race data into the database within a single transaction.
 *
 * @param raceData The structured data object scraped from a race page.
 *
 * @returns void
 */
export async function saveRaceData(raceData: RaceData): Promise<void> {
	const client = await pool.connect();
	console.log(`Saving data for race: ${raceData.raceName}`);

	try {
		/** Start a transaction. */
		await client.query('BEGIN');

		/** Insert the track if it doesn't exist, and get its ID. */
		const trackId = raceData.trackName
			.toLowerCase()
			.replace(/\s+/g, '_')
			.replace(/[^a-z0-9_]/g, '');
		await client.query(
			'INSERT INTO tracks (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2',
			[trackId, raceData.trackName]
		);

		/** Ensure season exists */
		await client.query(
			'INSERT INTO series (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
			['nascar_cup_series', 'NASCAR Cup Series']
		);

		const year = new Date(raceData.eventDate).getFullYear();
		const seasonRes = await client.query(
			'INSERT INTO seasons (series_id, year) VALUES ($1, $2) ON CONFLICT (series_id, year) DO UPDATE SET year = $2 RETURNING id',
			['nascar_cup_series', year]
		);
		const seasonId = seasonRes.rows[0].id;

		/** Insert the race event with better duplicate handling */
		const eventId = `${raceData.raceName
			.toLowerCase()
			.replace(/\s+/g, '_')
			.replace(/[^a-z0-9_]/g, '')}_${year}`;

		/** Check if event already exists with different date */
		const existingEvent = await client.query(
			'SELECT id, event_date FROM events WHERE id = $1',
			[eventId]
		);

		if (existingEvent.rows.length > 0) {
			const existingDate = new Date(existingEvent.rows[0].event_date);
			const newDate = new Date(raceData.eventDate);

			/** Only update if new date is later (handles rain delays) */
			if (newDate > existingDate) {
				await client.query('UPDATE events SET event_date = $1 WHERE id = $2', [
					raceData.eventDate,
					eventId
				]);

				console.log(`Updated event date for ${raceData.raceName}`);
			} else {
				console.log(`Skipping duplicate event: ${raceData.raceName}`);

				return; // Skip processing this duplicate
			}
		} else {
			await client.query(
				'INSERT INTO events (id, season_id, track_id, name, event_date) VALUES ($1, $2, $3, $4, $5)',
				[eventId, seasonId, trackId, raceData.raceName, raceData.eventDate]
			);
		}

		/** Loop through each driver's result and insert it. */
		for (const result of raceData.results) {
			/** Insert the team if it doesn't exist, and get its ID. */
			const teamId = result.teamName
				.toLowerCase()
				.replace(/\s+/g, '_')
				.replace(/[^a-z0-9_]/g, '');

			await client.query(
				'INSERT INTO teams (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2',
				[teamId, result.teamName]
			);

			/** Insert the driver if they don't exist, and get their ID. */
			const nameParts = result.driverName.split(' ');
			const firstName = nameParts[0] || '';
			const lastName = nameParts.slice(1).join(' ') || result.driverName;
			const driverId = result.driverName
				.toLowerCase()
				.replace(/\s+/g, '_')
				.replace(/[^a-z0-9_]/g, '');

			await client.query(
				'INSERT INTO drivers (id, first_name, last_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3',
				[driverId, firstName, lastName]
			);

			/** Insert the detailed race result. */
			await client.query(
				`INSERT INTO race_results 
          (event_id, driver_id, team_id, car_number, start_position, finish_position, laps_completed, laps_led, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (event_id, driver_id) DO UPDATE SET
          team_id = $3, car_number = $4, start_position = $5, finish_position = $6, 
          laps_completed = $7, laps_led = $8, status = $9`,
				[
					eventId,
					driverId,
					teamId,
					result.carNumber,
					result.startPosition,
					result.finishPosition,
					result.lapsCompleted,
					result.lapsLed,
					result.status
				]
			);
		}

		/** Commit the transaction. */
		await client.query('COMMIT');

		console.log(`Successfully saved data for race: ${raceData.raceName}`);
	} catch (error) {
		/** If any error occurs, roll back the transaction. */
		await client.query('ROLLBACK');

		console.error(
			`Error saving data for race: ${raceData.raceName}. Transaction rolled back.`
		);

		throw error; // Re-throw the error to be handled by the caller
	} finally {
		/** Release the client back to the pool. */
		client.release();
	}
}

import DataLoader from 'dataloader';
import type { Pool } from 'pg';
import type { AdvancedPool } from './database/advanced-pool';

export function createDataLoaders(db: any) {
	/** Batch load race results by event IDs */
	const raceResultsLoader = new DataLoader(
		async (eventIds: readonly string[]) => {
			const query = `
      SELECT 
        rr.event_id,
        rr.id, 
        rr.finish_position, 
        rr.start_position, 
        rr.car_number, 
        rr.laps_completed, 
        rr.laps_led, 
        rr.status,
        rr.manufacturer,
        rr.prize_money,
        rr.points,
        rr.pit_stops,
        rr.driver_rating,
        d.id as driver_id,
        CONCAT(d.first_name, ' ', d.last_name) as driver_name,
        t.id as team_id,
        t.name as team_name
      FROM race_results rr
      JOIN drivers d ON rr.driver_id = d.id
      JOIN teams t ON rr.team_id = t.id
      WHERE rr.event_id = ANY($1)
      ORDER BY rr.event_id, rr.finish_position ASC;
    `;

			const result = await db.query(query, [Array.from(eventIds)]);

			/** Group results by event_id */
			const resultsByEventId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const eventId = row.event_id;

				if (!resultsByEventId.has(eventId)) {
					resultsByEventId.set(eventId, []);
				}

				resultsByEventId.get(eventId)!.push({
					carNumber: row.car_number,
					driver: {
						id: row.driver_id,
						name: row.driver_name
					},
					driverRating: row.driver_rating
						? parseFloat(row.driver_rating)
						: null,
					finishPosition: row.finish_position,
					id: row.id,
					lapsCompleted: row.laps_completed,
					lapsLed: row.laps_led,
					manufacturer: row.manufacturer,
					pitStops: row.pit_stops,
					points: row.points,
					prizeMoney: row.prize_money ? parseFloat(row.prize_money) : null,
					startPosition: row.start_position,
					status: row.status,
					team: {
						id: row.team_id,
						name: row.team_name
					}
				});
			});

			/** Return results in the same order as requested eventIds */
			return eventIds.map((eventId) => resultsByEventId.get(eventId) || []);
		}
	);

	/** Batch load drivers by IDs */
	const driversLoader = new DataLoader(async (driverIds: readonly string[]) => {
		const result = await db.query(
			"SELECT id, CONCAT(first_name, ' ', last_name) as name, date_of_birth, hometown FROM drivers WHERE id = ANY($1)",
			[Array.from(driverIds)]
		);

		const driversMap = new Map(
			result.rows.map((row: any) => [
				row.id,
				{
					dateOfBirth: row.date_of_birth,
					hometown: row.hometown,
					id: row.id,
					name: row.name
				}
			])
		);

		return driverIds.map((id) => driversMap.get(id) || null);
	});

	/** Batch load teams by IDs */
	const teamsLoader = new DataLoader(async (teamIds: readonly string[]) => {
		const result = await db.query(
			'SELECT id, name, manufacturer, owner, location, founded_year FROM teams WHERE id = ANY($1)',
			[Array.from(teamIds)]
		);

		const teamsMap = new Map(
			result.rows.map((row: any) => [
				row.id,
				{
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				}
			])
		);
		return teamIds.map((id) => teamsMap.get(id) || null);
	});

	/** Batch load races by driver IDs */
	const driverRacesLoader = new DataLoader(
		async (driverIds: readonly string[]) => {
			const query = `
      SELECT DISTINCT
        rr.driver_id,
        e.id,
        e.name,
        e.track_id,
        e.event_date
      FROM race_results rr
      JOIN events e ON rr.event_id = e.id
      WHERE rr.driver_id = ANY($1)
      ORDER BY rr.driver_id, e.event_date DESC;
    `;

			const result = await db.query(query, [Array.from(driverIds)]);

			/** Group races by driver_id */
			const racesByDriverId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const driverId = row.driver_id;

				if (!racesByDriverId.has(driverId)) {
					racesByDriverId.set(driverId, []);
				}

				racesByDriverId.get(driverId)!.push({
					eventDate: row.event_date,
					id: row.id,
					name: row.name,
					track_id: row.track_id
				});
			});

			return driverIds.map((driverId) => racesByDriverId.get(driverId) || []);
		}
	);

	/** Batch load races by team IDs */
	const teamRacesLoader = new DataLoader(async (teamIds: readonly string[]) => {
		const query = `
      SELECT DISTINCT
        rr.team_id,
        e.id,
        e.name,
        e.track_id,
        e.event_date
      FROM race_results rr
      JOIN events e ON rr.event_id = e.id
      WHERE rr.team_id = ANY($1)
      ORDER BY rr.team_id, e.event_date DESC;
    `;

		const result = await db.query(query, [Array.from(teamIds)]);

		/** Group races by team_id */
		const racesByTeamId = new Map<string, any[]>();

		result.rows.forEach((row: any) => {
			const teamId = row.team_id;
			if (!racesByTeamId.has(teamId)) {
				racesByTeamId.set(teamId, []);
			}

			racesByTeamId.get(teamId)!.push({
				eventDate: row.event_date,
				id: row.id,
				name: row.name,
				track_id: row.track_id
			});
		});

		return teamIds.map((teamId) => racesByTeamId.get(teamId) || []);
	});

	/** Batch load tracks by IDs */
	const tracksLoader = new DataLoader(async (trackIds: readonly string[]) => {
		const result = await db.query(
			'SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE id = ANY($1)',
			[Array.from(trackIds)]
		);

		const tracksMap = new Map(
			result.rows.map((row: any) => [
				row.id,
				{
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}
			])
		);

		return trackIds.map((id) => tracksMap.get(id) || null);
	});

	/** Batch load races by track IDs */
	const trackRacesLoader = new DataLoader(
		async (trackIds: readonly string[]) => {
			const query = `
      SELECT 
        e.track_id,
        e.id,
        e.name,
        e.track_id as race_track_id,
        e.event_date
      FROM events e
      WHERE e.track_id = ANY($1)
      ORDER BY e.track_id, e.event_date DESC;
    `;

			const result = await db.query(query, [Array.from(trackIds)]);

			/** Group races by track_id */
			const racesByTrackId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const trackId = row.track_id;

				if (!racesByTrackId.has(trackId)) {
					racesByTrackId.set(trackId, []);
				}

				racesByTrackId.get(trackId)!.push({
					eventDate: row.event_date,
					id: row.id,
					name: row.name,
					track_id: row.race_track_id
				});
			});

			return trackIds.map((trackId) => racesByTrackId.get(trackId) || []);
		}
	);

	/** Batch load track statistics */
	const trackStatsLoader = new DataLoader(async (keys: readonly string[]) => {
		const queries = keys.map((key) => {
			const [trackId, driverId, teamId] = key.split('|');
			let whereClause = 'e.track_id = $1';
			const params = [trackId];

			if (driverId && driverId !== 'null') {
				whereClause += ' AND rr.driver_id = $2';
				params.push(driverId);
			}
			if (teamId && teamId !== 'null') {
				const paramIndex = params.length + 1;

				whereClause += ` AND rr.team_id = $${paramIndex}`;
				params.push(teamId);
			}

			return {
				key,
				params,
				query: `
          SELECT 
            COUNT(*) as total_races,
            AVG(rr.finish_position::numeric) as avg_finish,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
            COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
            COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens,
            SUM(rr.prize_money) as total_earnings,
            AVG(rr.prize_money) as avg_earnings,
            SUM(rr.points) as total_points,
            AVG(rr.points) as avg_points,
            AVG(rr.pit_stops) as avg_pit_stops,
            AVG(rr.driver_rating) as avg_driver_rating
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE ${whereClause}
        `
			};
		});

		const results = await Promise.all(
			queries.map(async ({ query, params }) => {
				const result = await db.query(query, params);
				return result.rows[0];
			})
		);

		return results.map((row) => ({
			avgDriverRating: row.avg_driver_rating
				? parseFloat(row.avg_driver_rating)
				: null,
			avgEarnings: row.avg_earnings ? parseFloat(row.avg_earnings) : null,
			avgFinishPosition: row.avg_finish ? parseFloat(row.avg_finish) : null,
			avgPitStops: row.avg_pit_stops ? parseFloat(row.avg_pit_stops) : null,
			avgPoints: row.avg_points ? parseFloat(row.avg_points) : null,
			topFives: Number(row.top_fives),
			topTens: Number(row.top_tens),
			totalEarnings: row.total_earnings ? parseFloat(row.total_earnings) : null,
			totalPoints: row.total_points ? Number(row.total_points) : null,
			totalRaces: Number(row.total_races),
			wins: Number(row.wins)
		}));
	});

	/** Batch load drivers by track IDs */
	const trackDriversLoader = new DataLoader(
		async (trackIds: readonly string[]) => {
			const query = `
      SELECT DISTINCT
        e.track_id,
        d.id,
        CONCAT(d.first_name, ' ', d.last_name) as name,
        d.date_of_birth,
        d.hometown
      FROM race_results rr
      JOIN events e ON rr.event_id = e.id
      JOIN drivers d ON rr.driver_id = d.id
      WHERE e.track_id = ANY($1)
      ORDER BY e.track_id, d.last_name, d.first_name;
    `;

			const result = await db.query(query, [Array.from(trackIds)]);

			/** Group drivers by track_id */
			const driversByTrackId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const trackId = row.track_id;

				if (!driversByTrackId.has(trackId)) {
					driversByTrackId.set(trackId, []);
				}

				driversByTrackId.get(trackId)!.push({
					dateOfBirth: row.date_of_birth,
					hometown: row.hometown,
					id: row.id,
					name: row.name
				});
			});

			return trackIds.map((trackId) => driversByTrackId.get(trackId) || []);
		}
	);

	// Batch load teams by track IDs
	const trackTeamsLoader = new DataLoader(
		async (trackIds: readonly string[]) => {
			const query = `
      SELECT DISTINCT
        e.track_id,
        t.id,
        t.name,
        t.manufacturer,
        t.owner,
        t.location,
        t.founded_year
      FROM race_results rr
      JOIN events e ON rr.event_id = e.id
      JOIN teams t ON rr.team_id = t.id
      WHERE e.track_id = ANY($1)
      ORDER BY e.track_id, t.name;
    `;

			const result = await db.query(query, [Array.from(trackIds)]);

			/** Group teams by track_id */
			const teamsByTrackId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const trackId = row.track_id;

				if (!teamsByTrackId.has(trackId)) {
					teamsByTrackId.set(trackId, []);
				}

				teamsByTrackId.get(trackId)!.push({
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				});
			});

			return trackIds.map((trackId) => teamsByTrackId.get(trackId) || []);
		}
	);

	/** Batch load teams by driver IDs */
	const driverTeamsLoader = new DataLoader(
		async (driverIds: readonly string[]) => {
			const query = `
      SELECT DISTINCT
        rr.driver_id,
        t.id,
        t.name,
        t.manufacturer,
        t.owner,
        t.location,
        t.founded_year
      FROM race_results rr
      JOIN teams t ON rr.team_id = t.id
      WHERE rr.driver_id = ANY($1)
      ORDER BY rr.driver_id, t.name;
    `;

			const result = await db.query(query, [Array.from(driverIds)]);

			/** Group teams by driver_id */
			const teamsByDriverId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const driverId = row.driver_id;

				if (!teamsByDriverId.has(driverId)) {
					teamsByDriverId.set(driverId, []);
				}

				teamsByDriverId.get(driverId)!.push({
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				});
			});

			return driverIds.map((driverId) => teamsByDriverId.get(driverId) || []);
		}
	);

	/** Batch load stage results by event IDs */
	const stageResultsLoader = new DataLoader(
		async (eventIds: readonly string[]) => {
			const query = `
      SELECT 
        sr.event_id,
        sr.id,
        sr.stage_number,
        sr.stage_points,
        d.id as driver_id,
        CONCAT(d.first_name, ' ', d.last_name) as driver_name,
        t.id as team_id,
        t.name as team_name
      FROM stage_results sr
      JOIN drivers d ON sr.driver_id = d.id
      JOIN teams t ON sr.team_id = t.id
      WHERE sr.event_id = ANY($1)
      ORDER BY sr.event_id, sr.stage_number ASC;
    `;

			const result = await db.query(query, [Array.from(eventIds)]);

			/** Group results by event_id */
			const resultsByEventId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const eventId = row.event_id;
				if (!resultsByEventId.has(eventId)) {
					resultsByEventId.set(eventId, []);
				}

				resultsByEventId.get(eventId)!.push({
					driver: {
						id: row.driver_id,
						name: row.driver_name
					},
					id: row.id,
					stageNumber: row.stage_number,
					stagePoints: row.stage_points,
					team: {
						id: row.team_id,
						name: row.team_name
					}
				});
			});

			/** Return results in the same order as requested eventIds */
			return eventIds.map((eventId) => resultsByEventId.get(eventId) || []);
		}
	);

	/** Batch load qualifying results by event IDs */
	const qualifyingResultsLoader = new DataLoader(
		async (eventIds: readonly string[]) => {
			const query = `
      SELECT 
        qr.event_id,
        qr.id,
        qr.qualifying_position,
        qr.qualifying_time,
        qr.qualifying_speed,
        d.id as driver_id,
        CONCAT(d.first_name, ' ', d.last_name) as driver_name,
        t.id as team_id,
        t.name as team_name
      FROM qualifying_results qr
      JOIN drivers d ON qr.driver_id = d.id
      JOIN teams t ON qr.team_id = t.id
      WHERE qr.event_id = ANY($1)
      ORDER BY qr.event_id, qr.qualifying_position ASC;
    `;

			const result = await db.query(query, [Array.from(eventIds)]);

			/** Group results by event_id */
			const resultsByEventId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const eventId = row.event_id;

				if (!resultsByEventId.has(eventId)) {
					resultsByEventId.set(eventId, []);
				}

				resultsByEventId.get(eventId)!.push({
					driver: {
						id: row.driver_id,
						name: row.driver_name
					},
					id: row.id,
					qualifyingPosition: row.qualifying_position,
					qualifyingSpeed: row.qualifying_speed
						? parseFloat(row.qualifying_speed)
						: null,
					qualifyingTime: row.qualifying_time,
					team: {
						id: row.team_id,
						name: row.team_name
					}
				});
			});

			/** Return results in the same order as requested eventIds */
			return eventIds.map((eventId) => resultsByEventId.get(eventId) || []);
		}
	);

	/** Batch load race cautions by event IDs */
	const raceCautionsLoader = new DataLoader(
		async (eventIds: readonly string[]) => {
			const query = `
      SELECT 
        rc.event_id,
        rc.id,
        rc.caution_number,
        rc.lap_start,
        rc.lap_end,
        rc.laps_under_caution,
        rc.reason
      FROM race_cautions rc
      WHERE rc.event_id = ANY($1)
      ORDER BY rc.event_id, rc.caution_number ASC;
    `;

			const result = await db.query(query, [Array.from(eventIds)]);

			/** Group results by event_id */
			const resultsByEventId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const eventId = row.event_id;

				if (!resultsByEventId.has(eventId)) {
					resultsByEventId.set(eventId, []);
				}

				resultsByEventId.get(eventId)!.push({
					cautionNumber: row.caution_number,
					id: row.id,
					lapEnd: row.lap_end,
					lapStart: row.lap_start,
					lapsUnderCaution: row.laps_under_caution,
					reason: row.reason
				});
			});

			/** Return results in the same order as requested eventIds */
			return eventIds.map((eventId) => resultsByEventId.get(eventId) || []);
		}
	);

	/** Batch load practice sessions by event IDs */
	const practiceSessionsLoader = new DataLoader(
		async (eventIds: readonly string[]) => {
			const query = `
      SELECT 
        ps.event_id,
        ps.id,
        ps.session_name,
        ps.session_date,
        ps.session_duration
      FROM practice_sessions ps
      WHERE ps.event_id = ANY($1)
      ORDER BY ps.event_id, ps.session_date ASC;
    `;

			const result = await db.query(query, [Array.from(eventIds)]);

			/** Group results by event_id */
			const resultsByEventId = new Map<string, any[]>();

			result.rows.forEach((row: any) => {
				const eventId = row.event_id;

				if (!resultsByEventId.has(eventId)) {
					resultsByEventId.set(eventId, []);
				}

				resultsByEventId.get(eventId)!.push({
					id: row.id,
					sessionDate: row.session_date,
					sessionDuration: row.session_duration,
					sessionName: row.session_name
				});
			});

			/** Return results in the same order as requested eventIds */
			return eventIds.map((eventId) => resultsByEventId.get(eventId) || []);
		}
	);

	/** Batch load practice results by session IDs */
	const practiceResultsLoader = new DataLoader(
		async (sessionIds: readonly number[]) => {
			const query = `
      SELECT 
        pr.session_id,
        pr.id,
        pr.position,
        pr.best_time,
        pr.best_speed,
        pr.laps_completed,
        d.id as driver_id,
        CONCAT(d.first_name, ' ', d.last_name) as driver_name,
        t.id as team_id,
        t.name as team_name
      FROM practice_results pr
      JOIN drivers d ON pr.driver_id = d.id
      JOIN teams t ON pr.team_id = t.id
      WHERE pr.session_id = ANY($1)
      ORDER BY pr.session_id, pr.position ASC;
    `;

			const result = await db.query(query, [Array.from(sessionIds)]);

			/** Group results by session_id */
			const resultsBySessionId = new Map<number, any[]>();

			result.rows.forEach((row: any) => {
				const sessionId = row.session_id;

				if (!resultsBySessionId.has(sessionId)) {
					resultsBySessionId.set(sessionId, []);
				}

				resultsBySessionId.get(sessionId)!.push({
					bestSpeed: row.best_speed ? parseFloat(row.best_speed) : null,
					bestTime: row.best_time,
					driver: {
						id: row.driver_id,
						name: row.driver_name
					},
					id: row.id,
					lapsCompleted: row.laps_completed,
					position: row.position,
					team: {
						id: row.team_id,
						name: row.team_name
					}
				});
			});

			/** Return results in the same order as requested sessionIds */
			return sessionIds.map(
				(sessionId) => resultsBySessionId.get(sessionId) || []
			);
		}
	);

	return {
		driverRacesLoader,
		driversLoader,
		driverTeamsLoader,
		practiceResultsLoader,
		practiceSessionsLoader,
		qualifyingResultsLoader,
		raceCautionsLoader,
		raceResultsLoader,
		stageResultsLoader,
		teamRacesLoader,
		teamsLoader,
		trackDriversLoader,
		trackRacesLoader,
		trackStatsLoader,
		tracksLoader,
		trackTeamsLoader
	};
}

export type DataLoaders = ReturnType<typeof createDataLoaders>;

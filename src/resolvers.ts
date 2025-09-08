import { NotFoundError } from './errors/error-classes';
import type { MyContext } from './server';

export const resolvers = {
	Driver: {
		/**
		 * Resolver for the "races" field on the Driver type.
		 * Supports filtering by year, track, with pagination.
		 */
		races: async (
			parent: { id: string },
			args: {
				year?: number;
				trackId?: string;
				limit?: number;
				offset?: number;
			},
			context: MyContext
		) => {
			try {
				let query = `
          SELECT DISTINCT
            e.id,
            e.name,
            e.track_id,
            e.event_date,
            e.lead_changes,
            e.different_leaders
          FROM events e
          JOIN race_results rr ON e.id = rr.event_id
          WHERE rr.driver_id = $1
        `;

				const params: any[] = [parent.id];
				let paramIndex = 2;

				/** Apply filters */
				if (args.year) {
					query += ` AND EXTRACT(YEAR FROM e.event_date) = $${paramIndex}`;
					params.push(args.year);
					paramIndex++;
				}

				if (args.trackId) {
					query += ` AND e.track_id = $${paramIndex}`;
					params.push(args.trackId);
					paramIndex++;
				}

				query += ' ORDER BY e.event_date DESC';

				/** Apply pagination */
				if (args.limit) {
					query += ` LIMIT $${paramIndex}`;
					params.push(args.limit);
					paramIndex++;
				}

				if (args.offset) {
					query += ` OFFSET $${paramIndex}`;
					params.push(args.offset);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					differentLeaders: row.different_leaders,
					event_date: row.event_date,
					id: row.id,
					leadChanges: row.lead_changes,
					name: row.name,
					track_id: row.track_id
				}));
			} catch (error) {
				console.error(`Error fetching races for driver ${parent.id}:`, error);
				throw new Error('Could not fetch driver races.');
			}
		},

		/**
		 * Resolver for the "teams" field on the Driver type.
		 */
		teams: async (parent: { id: string }, _args: any, context: MyContext) => {
			try {
				return await context.dataloaders.driverTeamsLoader.load(parent.id);
			} catch (error) {
				console.error(`Error fetching teams for driver ${parent.id}:`, error);
				throw new Error('Could not fetch driver teams.');
			}
		}
	},

	PracticeSession: {
		/**
		 * Resolver for the "results" field on the PracticeSession type.
		 * Uses DataLoader to batch fetch practice results and eliminate N+1 queries.
		 */
		results: async (parent: { id: number }, _args: any, context: MyContext) => {
			try {
				return await context.dataloaders.practiceResultsLoader.load(parent.id);
			} catch (error) {
				console.error(
					`Error fetching results for practice session ${parent.id}:`,
					error
				);
				throw new Error('Could not fetch practice results.');
			}
		}
	},
	Query: {
		averageRatingByTrack: async (
			_parent: any,
			args: { trackId: string },
			context: MyContext
		) => {
			try {
				const query = `
          SELECT AVG(rr.driver_rating) as avg_rating
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE e.track_id = $1 AND rr.driver_rating IS NOT NULL
        `;

				const result = await context.db.query(query, [args.trackId]);
				const row = result.rows[0];

				return row.avg_rating ? parseFloat(row.avg_rating) : null;
			} catch (error) {
				console.error('Error fetching average rating by track:', error);
				throw new Error('Could not fetch average rating by track.');
			}
		},

		cautionReasons: async (
			_parent: any,
			args: { year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT DISTINCT rc.reason
          FROM race_cautions rc
          JOIN events e ON rc.event_id = e.id
          WHERE rc.reason IS NOT NULL
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query += ' ORDER BY rc.reason';

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => row.reason);
			} catch (error) {
				console.error('Error fetching caution reasons:', error);
				throw new Error('Could not fetch caution reasons.');
			}
		},

		championshipStandings: async (
			_parent: any,
			args: { year: number },
			context: MyContext
		) => {
			try {
				/** Try to get from cache first */
				const cached = await context.cache.getCachedStandings(args.year);

				/** If cached, return the cached data */
				if (cached) {
					return cached;
				}

				const query = `
          SELECT 
            d.id,
            CONCAT(d.first_name, ' ', d.last_name) as name,
            SUM(rr.points) as total_points
          FROM race_results rr
          JOIN drivers d ON rr.driver_id = d.id
          JOIN events e ON rr.event_id = e.id
          WHERE EXTRACT(YEAR FROM e.event_date) = $1
          GROUP BY d.id, d.first_name, d.last_name 
          ORDER BY total_points DESC
        `;

				const result = await context.db.query(query, [args.year]);
				const standings = result.rows.map((row: any) => ({
					id: row.id,
					name: row.name,
					totalPoints: row.total_points ? Number(row.total_points) : 0
				}));

				/** Cache the results */
				await context.cache.cacheStandings(args.year, standings);

				return standings;
			} catch (error) {
				console.error(`Error fetching championship standings: ${error}`);

				throw new Error('Could not fetch championship standings.');
			}
		},

		dirtTracks: async (_parent: any, _args: any, context: MyContext) => {
			try {
				const result = await context.db.query(
					"SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE surface = 'dirt' ORDER BY name"
				);

				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error(`Error fetching dirt tracks: ${error}`);

				throw new Error('Could not fetch dirt tracks.');
			}
		},

		/**
		 * Resolver for the "driver" query.
		 * Fetches a single driver by their unique ID.
		 */
		driver: async (_parent: any, args: { id: string }, context: MyContext) => {
			try {
				const result = await context.db.query(
					"SELECT id, CONCAT(first_name, ' ', last_name) as name, date_of_birth, hometown FROM drivers WHERE id = $1",
					[args.id]
				);

				if (result.rows.length === 0) {
					throw new NotFoundError('Driver', args.id);
				}

				const row = result.rows[0];

				return {
					dateOfBirth: row.date_of_birth,
					hometown: row.hometown,
					id: row.id,
					name: row.name
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					throw error;
				}

				console.error(`Error fetching driver with id ${args.id}:`, error);

				throw new Error('Could not fetch driver.');
			}
		},

		/**
		 * Financial analytics resolvers
		 */
		driverEarnings: async (
			_parent: any,
			args: { driverId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            SUM(rr.prize_money) as total_earnings,
            AVG(rr.prize_money) as avg_earnings,
            MAX(rr.prize_money) as highest_payout,
            COUNT(*) as races
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.driver_id = $1
        `;
				const params: any[] = [args.driverId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					averageEarnings: row.avg_earnings
						? parseFloat(row.avg_earnings)
						: null,
					highestPayout: row.highest_payout
						? parseFloat(row.highest_payout)
						: null,
					races: Number(row.races),
					totalEarnings: row.total_earnings ? parseFloat(row.total_earnings) : 0
				};
			} catch (error) {
				console.error(`Error fetching driver earnings: ${error}`);

				throw new Error('Could not fetch driver earnings.');
			}
		},

		/**
		 * Championship analytics resolvers
		 */
		driverPoints: async (
			_parent: any,
			args: { driverId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            SUM(rr.points) as total_points,
            AVG(rr.points) as avg_points,
            COUNT(*) as races,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
            COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
            COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.driver_id = $1
        `;
				const params: any[] = [args.driverId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					averagePoints: row.avg_points ? parseFloat(row.avg_points) : null,
					races: Number(row.races),
					topFives: Number(row.top_fives),
					topTens: Number(row.top_tens),
					totalPoints: row.total_points ? Number(row.total_points) : 0,
					wins: Number(row.wins)
				};
			} catch (error) {
				console.error(`Error fetching driver points: ${error}`);

				throw new Error('Could not fetch driver points.');
			}
		},

		/**
		 * Qualifying analytics resolvers
		 */
		driverQualifyingStats: async (
			_parent: any,
			args: { driverId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(*) as total_qualifying,
            COUNT(CASE WHEN qr.qualifying_position = 1 THEN 1 END) as poles,
            AVG(qr.qualifying_position::numeric) as avg_qualifying_position,
            MIN(qr.qualifying_position) as best_qualifying_position,
            AVG(qr.qualifying_speed) as avg_qualifying_speed,
            MAX(qr.qualifying_speed) as fastest_qualifying_speed
          FROM qualifying_results qr
          JOIN events e ON qr.event_id = e.id
          WHERE qr.driver_id = $1
        `;
				const params: any[] = [args.driverId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				const totalQualifying = Number(row.total_qualifying || 0);
				const poles = Number(row.poles || 0);

				return {
					avgQualifyingPosition: row.avg_qualifying_position
						? parseFloat(row.avg_qualifying_position)
						: null,
					avgQualifyingSpeed: row.avg_qualifying_speed
						? parseFloat(row.avg_qualifying_speed)
						: null,
					bestQualifyingPosition: row.best_qualifying_position
						? Number(row.best_qualifying_position)
						: null,
					fastestQualifyingSpeed: row.fastest_qualifying_speed
						? parseFloat(row.fastest_qualifying_speed)
						: null,
					polePercentage:
						totalQualifying > 0 ? (poles / totalQualifying) * 100 : 0,
					poles,
					totalQualifying
				};
			} catch (error) {
				console.error(`Error fetching driver qualifying stats: ${error}`);

				throw new Error('Could not fetch driver qualifying stats.');
			}
		},

		/**
		 * Driver rating analytics resolvers
		 */
		driverRatingStats: async (
			_parent: any,
			args: { driverId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            AVG(rr.driver_rating) as avg_rating,
            MAX(rr.driver_rating) as highest_rating,
            MIN(rr.driver_rating) as lowest_rating,
            COUNT(*) as races
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.driver_id = $1 AND rr.driver_rating IS NOT NULL
        `;
				const params: any[] = [args.driverId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					averageRating: row.avg_rating ? parseFloat(row.avg_rating) : null,
					highestRating: row.highest_rating
						? parseFloat(row.highest_rating)
						: null,
					lowestRating: row.lowest_rating
						? parseFloat(row.lowest_rating)
						: null,
					races: Number(row.races)
				};
			} catch (error) {
				console.error(`Error fetching driver rating stats: ${error}`);

				throw new Error('Could not fetch driver rating stats.');
			}
		},

		/**
		 * Stage analytics resolvers
		 */
		driverStageStats: async (
			_parent: any,
			args: { driverId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(*) as stage_wins,
            SUM(sr.stage_points) as total_stage_points,
            AVG(sr.stage_points) as avg_stage_points,
            COUNT(DISTINCT sr.event_id) as races
          FROM stage_results sr
          JOIN events e ON sr.event_id = e.id
          WHERE sr.driver_id = $1
        `;
				const params: any[] = [args.driverId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					avgStagePoints: row.avg_stage_points
						? parseFloat(row.avg_stage_points)
						: null,
					races: Number(row.races || 0),
					stageWins: Number(row.stage_wins || 0),
					totalStagePoints: Number(row.total_stage_points || 0)
				};
			} catch (error) {
				console.error(`Error fetching driver stage stats: ${error}`);

				throw new Error('Could not fetch driver stage stats.');
			}
		},

		/**
		 * Comprehensive analytics resolvers
		 */
		driverStats: async (
			_parent: any,
			args: { driverId: string; trackId?: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(*) as total_races,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
            COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
            COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens,
            COUNT(CASE WHEN rr.start_position = 1 THEN 1 END) as poles,
            AVG(rr.finish_position::numeric) as avg_finish,
            AVG(rr.start_position::numeric) as avg_start,
            SUM(rr.laps_led) as total_laps_led,
            AVG(rr.laps_led::numeric) as avg_laps_led,
            SUM(rr.points) as total_points,
            AVG(rr.points::numeric) as avg_points,
            SUM(rr.prize_money) as total_earnings,
            AVG(rr.prize_money) as avg_earnings,
            AVG(rr.driver_rating) as avg_rating,
            AVG(rr.pit_stops::numeric) as avg_pit_stops
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.driver_id = $1
        `;
				const params: any[] = [args.driverId];

				if (args.trackId) {
					query += ' AND e.track_id = $2';
					params.push(args.trackId);
				}

				if (args.year) {
					query += ` AND EXTRACT(YEAR FROM e.event_date) = $${params.length + 1}`;
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				const totalRaces = Number(row.total_races);
				const wins = Number(row.wins);
				const topFives = Number(row.top_fives);
				const topTens = Number(row.top_tens);

				return {
					avgDriverRating: row.avg_rating ? parseFloat(row.avg_rating) : null,
					avgEarnings: row.avg_earnings ? parseFloat(row.avg_earnings) : null,
					avgFinishPosition: row.avg_finish ? parseFloat(row.avg_finish) : null,
					avgLapsLed: row.avg_laps_led ? parseFloat(row.avg_laps_led) : null,
					avgPitStops: row.avg_pit_stops ? parseFloat(row.avg_pit_stops) : null,
					avgPoints: row.avg_points ? parseFloat(row.avg_points) : null,
					avgStartPosition: row.avg_start ? parseFloat(row.avg_start) : null,
					poles: Number(row.poles),
					topFivePercentage: totalRaces > 0 ? (topFives / totalRaces) * 100 : 0,
					topFives,
					topTenPercentage: totalRaces > 0 ? (topTens / totalRaces) * 100 : 0,
					topTens,
					totalEarnings: row.total_earnings
						? parseFloat(row.total_earnings)
						: null,
					totalLapsLed: Number(row.total_laps_led || 0),
					totalPoints: row.total_points ? Number(row.total_points) : null,
					totalRaces,
					winPercentage: totalRaces > 0 ? (wins / totalRaces) * 100 : 0,
					wins
				};
			} catch (error) {
				console.error(`Error fetching driver stats: ${error}`);

				throw new Error('Could not fetch driver stats.');
			}
		},

		/**
		 * Resolver for the "driversByHometown" query.
		 * Fetches drivers from a specific hometown.
		 */
		driversByHometown: async (
			_parent: any,
			args: { hometown: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					"SELECT id, CONCAT(first_name, ' ', last_name) as name, date_of_birth, hometown FROM drivers WHERE hometown = $1 ORDER BY last_name, first_name",
					[args.hometown]
				);

				return result.rows.map((row: any) => ({
					dateOfBirth: row.date_of_birth,
					hometown: row.hometown,
					id: row.id,
					name: row.name
				}));
			} catch (error) {
				console.error(`Error fetching drivers from ${args.hometown}: ${error}`);

				throw new Error('Could not fetch drivers by hometown.');
			}
		},

		fastestPracticeTimes: async (
			_parent: any,
			args: { eventId: string; limit?: number },
			context: MyContext
		) => {
			try {
				const query = `
          SELECT 
            pr.id,
            pr.position,
            pr.best_time,
            pr.best_speed,
            pr.laps_completed,
            ps.session_name,
            d.id as driver_id,
            CONCAT(d.first_name, ' ', d.last_name) as driver_name,
            t.id as team_id,
            t.name as team_name
          FROM practice_results pr
          JOIN practice_sessions ps ON pr.session_id = ps.id
          JOIN drivers d ON pr.driver_id = d.id
          JOIN teams t ON pr.team_id = t.id
          WHERE ps.event_id = $1 AND pr.best_speed IS NOT NULL
          ORDER BY pr.best_speed DESC
          LIMIT $2
        `;

				const result = await context.db.query(query, [
					args.eventId,
					args.limit || 10
				]);
				return result.rows.map((row: any) => ({
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
				}));
			} catch (error) {
				console.error(`Error fetching fastest practice times: ${error}`);

				throw new Error('Could not fetch fastest practice times.');
			}
		},

		fastestQualifiers: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
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
          JOIN events e ON qr.event_id = e.id
          WHERE qr.qualifying_speed IS NOT NULL
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query += ' ORDER BY qr.qualifying_speed DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
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
				}));
			} catch (error) {
				console.error(`Error fetching fastest qualifiers: ${error}`);

				throw new Error('Could not fetch fastest qualifiers.');
			}
		},

		highestPayouts: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            rr.id,
            rr.finish_position,
            rr.start_position,
            rr.car_number,
            rr.laps_completed,
            rr.laps_led,
            rr.status,
            rr.manufacturer,
            rr.prize_money,
            d.id as driver_id,
            CONCAT(d.first_name, ' ', d.last_name) as driver_name,
            t.id as team_id,
            t.name as team_name
          FROM race_results rr
          JOIN drivers d ON rr.driver_id = d.id
          JOIN teams t ON rr.team_id = t.id
          JOIN events e ON rr.event_id = e.id
          WHERE rr.prize_money IS NOT NULL
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query += ' ORDER BY rr.prize_money DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					carNumber: row.car_number,
					driver: {
						id: row.driver_id,
						name: row.driver_name
					},
					finishPosition: row.finish_position,
					id: row.id,
					lapsCompleted: row.laps_completed,
					lapsLed: row.laps_led,
					manufacturer: row.manufacturer,
					prizeMoney: row.prize_money ? parseFloat(row.prize_money) : null,
					startPosition: row.start_position,
					status: row.status,
					team: {
						id: row.team_id,
						name: row.team_name
					}
				}));
			} catch (error) {
				console.error(`Error fetching highest payouts: ${error}`);

				throw new Error('Could not fetch highest payouts.');
			}
		},

		/**
		 * Manufacturer analytics resolvers
		 */
		manufacturerStats: async (
			_parent: any,
			args: { trackId?: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            rr.manufacturer,
            COUNT(*) as total_races,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
            COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
            COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens,
            AVG(rr.finish_position::numeric) as avg_finish
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
        `;

				const conditions = [];
				const params: any[] = [];

				if (args.trackId) {
					conditions.push(`e.track_id = $${params.length + 1}`);
					params.push(args.trackId);
				}
				if (args.year) {
					conditions.push(
						`EXTRACT(YEAR FROM e.event_date) = $${params.length + 1}`
					);
					params.push(args.year);
				}

				if (conditions.length > 0) {
					query += ' WHERE ' + conditions.join(' AND ');
				}

				query +=
					' GROUP BY rr.manufacturer ORDER BY wins DESC, total_races DESC';

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					avgFinishPosition: row.avg_finish ? parseFloat(row.avg_finish) : null,
					manufacturer: row.manufacturer,
					topFives: Number(row.top_fives),
					topTens: Number(row.top_tens),
					totalRaces: Number(row.total_races),
					wins: Number(row.wins)
				}));
			} catch (error) {
				console.error(`Error fetching manufacturer stats: ${error}`);

				throw new Error('Could not fetch manufacturer stats.');
			}
		},

		mostCautionRaces: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            e.id,
            e.name,
            e.track_id,
            e.event_date,
            COUNT(rc.id) as caution_count
          FROM events e
          LEFT JOIN race_cautions rc ON e.id = rc.event_id
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' WHERE EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query +=
					' GROUP BY e.id, e.name, e.track_id, e.event_date ORDER BY caution_count DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					event_date: row.event_date,
					id: row.id,
					name: row.name,
					track_id: row.track_id
				}));
			} catch (error) {
				console.error(`Error fetching most caution races: ${error}`);

				throw new Error('Could not fetch most caution races.');
			}
		},

		mostCompetitiveRaces: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            e.id,
            e.name,
            e.track_id,
            e.event_date,
            e.lead_changes,
            e.different_leaders
          FROM events e
          WHERE e.lead_changes IS NOT NULL
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query += ' ORDER BY e.lead_changes DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					differentLeaders: row.different_leaders,
					event_date: row.event_date,
					id: row.id,
					leadChanges: row.lead_changes,
					name: row.name,
					track_id: row.track_id
				}));
			} catch (error) {
				console.error(`Error fetching most competitive races: ${error}`);

				throw new Error('Could not fetch most competitive races.');
			}
		},

		mostLeaderRaces: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            e.id,
            e.name,
            e.track_id,
            e.event_date,
            e.lead_changes,
            e.different_leaders
          FROM events e
          WHERE e.different_leaders IS NOT NULL
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query += ' ORDER BY e.different_leaders DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);

				return result.rows.map((row: any) => ({
					differentLeaders: row.different_leaders,
					event_date: row.event_date,
					id: row.id,
					leadChanges: row.lead_changes,
					name: row.name,
					track_id: row.track_id
				}));
			} catch (error) {
				console.error(`Error fetching most leader races: ${error}`);

				throw new Error('Could not fetch most leader races.');
			}
		},

		pointsLeaders: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            d.id,
            CONCAT(d.first_name, ' ', d.last_name) as name,
            SUM(rr.points) as total_points
          FROM race_results rr
          JOIN drivers d ON rr.driver_id = d.id
          JOIN events e ON rr.event_id = e.id
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' WHERE EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query +=
					' GROUP BY d.id, d.first_name, d.last_name ORDER BY total_points DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					id: row.id,
					name: row.name
				}));
			} catch (error) {
				console.error(`Error fetching points leaders: ${error}`);

				throw new Error('Could not fetch points leaders.');
			}
		},

		/**
		 * Practice session resolvers
		 */
		practiceSessions: async (
			_parent: any,
			args: { eventId: string },
			context: MyContext
		) => {
			try {
				return await context.dataloaders.practiceSessionsLoader.load(
					args.eventId
				);
			} catch (error) {
				console.error(
					`Error fetching practice sessions for event ${args.eventId}: ${error}`,
					error
				);

				throw new Error('Could not fetch practice sessions.');
			}
		},

		/**
		 * Resolver for the "race" query.
		 * Fetches a single race by its unique ID.
		 */
		race: async (_parent: any, args: { id: string }, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, track_id, event_date, lead_changes, different_leaders, series_id FROM events WHERE id = $1',
					[args.id]
				);

				if (result.rows.length === 0) {
					throw new NotFoundError('Race', args.id);
				}

				const row = result.rows[0];

				return {
					differentLeaders: row.different_leaders,
					event_date: row.event_date,
					id: row.id,
					leadChanges: row.lead_changes,
					name: row.name,
					series_id: row.series_id,
					track_id: row.track_id
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					throw error;
				}

				console.error(`Error fetching race with id ${args.id}: ${error}`);

				throw new Error('Could not fetch race.');
			}
		},
		/**
		 * Resolver for the "races" query with enhanced filtering.
		 */
		races: async (_parent: any, args: { filter?: any }, context: MyContext) => {
			try {
				let query =
					'SELECT DISTINCT e.id, e.name, e.track_id, e.event_date, e.lead_changes, e.different_leaders, e.series_id FROM events e';
				const conditions = [];
				const params: any[] = [];

				if (args.filter) {
					if (args.filter.year) {
						conditions.push(
							`EXTRACT(YEAR FROM e.event_date) = $${params.length + 1}`
						);

						params.push(args.filter.year);
					}

					if (args.filter.trackId) {
						conditions.push(`e.track_id = $${params.length + 1}`);
						params.push(args.filter.trackId);
					}

					if (args.filter.seriesId) {
						conditions.push(`e.series_id = $${params.length + 1}`);
						params.push(args.filter.seriesId);
					}

					if (args.filter.manufacturer) {
						query += ' JOIN race_results rr ON e.id = rr.event_id';
						conditions.push(`rr.manufacturer = $${params.length + 1}`);
						params.push(args.filter.manufacturer);
					}
				}

				if (conditions.length > 0) {
					query += ` WHERE ${conditions.join(' AND ')}`;
				}

				query += ' ORDER BY e.event_date DESC';

				if (args.filter?.limit) {
					query += ` LIMIT $${params.length + 1}`;

					params.push(args.filter.limit);
				}

				if (args.filter?.offset) {
					query += ` OFFSET $${params.length + 1}`;

					params.push(args.filter.offset);
				}

				const result = await context.db.query(query, params);

				return result.rows.map((row: any) => ({
					differentLeaders: row.different_leaders,
					event_date: row.event_date,
					id: row.id,
					leadChanges: row.lead_changes,
					name: row.name,
					series_id: row.series_id,
					track_id: row.track_id
				}));
			} catch (error) {
				console.error(`Error fetching races: ${error}`);

				throw new Error('Could not fetch races.');
			}
		},

		racesByManufacturer: async (
			_parent: any,
			args: { manufacturer: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					`
          SELECT DISTINCT e.id, e.name, e.track_id, e.event_date
          FROM events e
          JOIN race_results rr ON e.id = rr.event_id
          WHERE rr.manufacturer = $1
          ORDER BY e.event_date DESC
        `,
					[args.manufacturer]
				);

				return result.rows;
			} catch (error) {
				console.error(`Error fetching races by manufacturer: ${error}`);

				throw new Error('Could not fetch races by manufacturer.');
			}
		},

		roadCourses: async (_parent: any, _args: any, context: MyContext) => {
			try {
				const result = await context.db.query(
					"SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE type = 'Road Course' ORDER BY name"
				);

				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error(`Error fetching road courses: ${error}`);

				throw new Error('Could not fetch road courses.');
			}
		},

		/**
		 * Series resolvers
		 */
		series: async (_parent: any, _args: any, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, full_name, abbreviation FROM series ORDER BY name'
				);

				return result.rows.map((row: any) => ({
					abbreviation: row.abbreviation,
					fullName: row.full_name,
					id: row.id,
					name: row.name
				}));
			} catch (error) {
				console.error(`Error fetching series: ${error}`);

				throw new Error('Could not fetch series.');
			}
		},

		seriesById: async (
			_parent: any,
			args: { id: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, full_name, abbreviation FROM series WHERE id = $1',
					[args.id]
				);

				if (result.rows.length === 0) {
					throw new NotFoundError('Series', args.id);
				}

				const row = result.rows[0];

				return {
					abbreviation: row.abbreviation,
					fullName: row.full_name,
					id: row.id,
					name: row.name
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					throw error;
				}

				console.error(`Error fetching series with id ${args.id}: ${error}`);

				throw new Error('Could not fetch series.');
			}
		},

		shortTracks: async (_parent: any, _args: any, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE length_miles < 1.0 ORDER BY length_miles'
				);

				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error(`Error fetching short tracks: ${error}`);

				throw new Error('Could not fetch short tracks.');
			}
		},

		sponsor: async (_parent: any, args: { id: string }, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, industry, website FROM sponsors WHERE id = $1',
					[args.id]
				);

				if (result.rows.length === 0) {
					throw new NotFoundError('Sponsor', args.id);
				}

				return result.rows[0];
			} catch (error) {
				if (error instanceof NotFoundError) {
					throw error;
				}

				console.error(`Error fetching sponsor with id ${args.id}: ${error}`);
				throw new Error('Could not fetch sponsor.');
			}
		},

		sponsorStats: async (
			_parent: any,
			args: { sponsorId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(*) as total_races,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
            COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
            COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens,
            AVG(rr.finish_position::numeric) as avg_finish_position,
            SUM(rr.prize_money) as total_earnings
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.sponsor_id = $1
        `;
				const params: any[] = [args.sponsorId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				const totalRaces = Number(row.total_races || 0);
				const wins = Number(row.wins || 0);

				return {
					avgFinishPosition: row.avg_finish_position
						? parseFloat(row.avg_finish_position)
						: null,
					topFives: Number(row.top_fives || 0),
					topTens: Number(row.top_tens || 0),
					totalEarnings: row.total_earnings
						? parseFloat(row.total_earnings)
						: null,
					totalRaces,
					winPercentage: totalRaces > 0 ? (wins / totalRaces) * 100 : 0,
					wins
				};
			} catch (error) {
				console.error(`Error fetching sponsor stats: ${error}`);

				throw new Error('Could not fetch sponsor stats.');
			}
		},

		/**
		 * Sponsor resolvers
		 */
		sponsors: async (_parent: any, _args: any, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, industry, website FROM sponsors ORDER BY name'
				);

				return result.rows;
			} catch (error) {
				console.error(`Error fetching sponsors: ${error}`);

				throw new Error('Could not fetch sponsors.');
			}
		},

		sponsorsByIndustry: async (
			_parent: any,
			args: { industry: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, industry, website FROM sponsors WHERE industry = $1 ORDER BY name',
					[args.industry]
				);
				return result.rows;
			} catch (error) {
				console.error(
					`Error fetching sponsors by industry ${args.industry}: ${error}`
				);

				throw new Error('Could not fetch sponsors by industry.');
			}
		},

		superspeedways: async (_parent: any, _args: any, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE length_miles > 2.0 ORDER BY length_miles DESC'
				);

				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error(`Error fetching superspeedways: ${error}`);

				throw new Error('Could not fetch superspeedways.');
			}
		},

		/**
		 * Resolver for the "team" query.
		 * Fetches a single team by their unique ID.
		 */
		team: async (_parent: any, args: { id: string }, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, manufacturer, owner, location, founded_year FROM teams WHERE id = $1',
					[args.id]
				);
				if (result.rows.length === 0) {
					throw new NotFoundError('Team', args.id);
				}
				const row = result.rows[0];
				return {
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					throw error;
				}

				console.error(`Error fetching team with id ${args.id}: ${error}`);

				throw new Error('Could not fetch team.');
			}
		},

		teamEarnings: async (
			_parent: any,
			args: { teamId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            SUM(rr.prize_money) as total_earnings,
            AVG(rr.prize_money) as avg_earnings,
            MAX(rr.prize_money) as highest_payout,
            COUNT(*) as races
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.team_id = $1
        `;
				const params: any[] = [args.teamId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					averageEarnings: row.avg_earnings
						? parseFloat(row.avg_earnings)
						: null,
					highestPayout: row.highest_payout
						? parseFloat(row.highest_payout)
						: null,
					races: Number(row.races),
					totalEarnings: row.total_earnings ? parseFloat(row.total_earnings) : 0
				};
			} catch (error) {
				console.error(`Error fetching team earnings: ${error}`);

				throw new Error('Could not fetch team earnings.');
			}
		},

		teamPoints: async (
			_parent: any,
			args: { teamId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            SUM(rr.points) as total_points,
            AVG(rr.points) as avg_points,
            COUNT(*) as races,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
            COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
            COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.team_id = $1
        `;
				const params: any[] = [args.teamId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					averagePoints: row.avg_points ? parseFloat(row.avg_points) : null,
					races: Number(row.races),
					topFives: Number(row.top_fives),
					topTens: Number(row.top_tens),
					totalPoints: row.total_points ? Number(row.total_points) : 0,
					wins: Number(row.wins)
				};
			} catch (error) {
				console.error(`Error fetching team points: ${error}`);

				throw new Error('Could not fetch team points.');
			}
		},

		teamQualifyingStats: async (
			_parent: any,
			args: { teamId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(*) as total_qualifying,
            COUNT(CASE WHEN qr.qualifying_position = 1 THEN 1 END) as poles,
            AVG(qr.qualifying_position::numeric) as avg_qualifying_position,
            MIN(qr.qualifying_position) as best_qualifying_position,
            AVG(qr.qualifying_speed) as avg_qualifying_speed,
            MAX(qr.qualifying_speed) as fastest_qualifying_speed
          FROM qualifying_results qr
          JOIN events e ON qr.event_id = e.id
          WHERE qr.team_id = $1
        `;
				const params: any[] = [args.teamId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				const totalQualifying = Number(row.total_qualifying || 0);
				const poles = Number(row.poles || 0);

				return {
					avgQualifyingPosition: row.avg_qualifying_position
						? parseFloat(row.avg_qualifying_position)
						: null,
					avgQualifyingSpeed: row.avg_qualifying_speed
						? parseFloat(row.avg_qualifying_speed)
						: null,
					bestQualifyingPosition: row.best_qualifying_position
						? Number(row.best_qualifying_position)
						: null,
					fastestQualifyingSpeed: row.fastest_qualifying_speed
						? parseFloat(row.fastest_qualifying_speed)
						: null,
					polePercentage:
						totalQualifying > 0 ? (poles / totalQualifying) * 100 : 0,
					poles,
					totalQualifying
				};
			} catch (error) {
				console.error(`Error fetching team qualifying stats: ${error}`);

				throw new Error('Could not fetch team qualifying stats.');
			}
		},

		teamStageStats: async (
			_parent: any,
			args: { teamId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(*) as stage_wins,
            SUM(sr.stage_points) as total_stage_points,
            AVG(sr.stage_points) as avg_stage_points,
            COUNT(DISTINCT sr.event_id) as races
          FROM stage_results sr
          JOIN events e ON sr.event_id = e.id
          WHERE sr.team_id = $1
        `;
				const params: any[] = [args.teamId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					avgStagePoints: row.avg_stage_points
						? parseFloat(row.avg_stage_points)
						: null,
					races: Number(row.races || 0),
					stageWins: Number(row.stage_wins || 0),
					totalStagePoints: Number(row.total_stage_points || 0)
				};
			} catch (error) {
				console.error(`Error fetching team stage stats: ${error}`);

				throw new Error('Could not fetch team stage stats.');
			}
		},

		teamStats: async (
			_parent: any,
			args: { teamId: string; trackId?: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(*) as total_races,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins,
            COUNT(CASE WHEN rr.finish_position <= 5 THEN 1 END) as top_fives,
            COUNT(CASE WHEN rr.finish_position <= 10 THEN 1 END) as top_tens,
            COUNT(CASE WHEN rr.start_position = 1 THEN 1 END) as poles,
            AVG(rr.finish_position::numeric) as avg_finish,
            AVG(rr.start_position::numeric) as avg_start,
            SUM(rr.laps_led) as total_laps_led,
            AVG(rr.laps_led::numeric) as avg_laps_led,
            SUM(rr.points) as total_points,
            AVG(rr.points::numeric) as avg_points,
            SUM(rr.prize_money) as total_earnings,
            AVG(rr.prize_money) as avg_earnings,
            AVG(rr.driver_rating) as avg_rating,
            AVG(rr.pit_stops::numeric) as avg_pit_stops,
            COUNT(DISTINCT rr.driver_id) as active_drivers
          FROM race_results rr
          JOIN events e ON rr.event_id = e.id
          WHERE rr.team_id = $1
        `;
				const params: any[] = [args.teamId];

				if (args.trackId) {
					query += ' AND e.track_id = $2';
					params.push(args.trackId);
				}

				if (args.year) {
					query += ` AND EXTRACT(YEAR FROM e.event_date) = $${params.length + 1}`;
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				const totalRaces = Number(row.total_races);
				const wins = Number(row.wins);
				const topFives = Number(row.top_fives);
				const topTens = Number(row.top_tens);

				return {
					activeDrivers: Number(row.active_drivers),
					avgDriverRating: row.avg_rating ? parseFloat(row.avg_rating) : null,
					avgEarnings: row.avg_earnings ? parseFloat(row.avg_earnings) : null,
					avgFinishPosition: row.avg_finish ? parseFloat(row.avg_finish) : null,
					avgLapsLed: row.avg_laps_led ? parseFloat(row.avg_laps_led) : null,
					avgPitStops: row.avg_pit_stops ? parseFloat(row.avg_pit_stops) : null,
					avgPoints: row.avg_points ? parseFloat(row.avg_points) : null,
					avgStartPosition: row.avg_start ? parseFloat(row.avg_start) : null,
					poles: Number(row.poles),
					topFivePercentage: totalRaces > 0 ? (topFives / totalRaces) * 100 : 0,
					topFives,
					topTenPercentage: totalRaces > 0 ? (topTens / totalRaces) * 100 : 0,
					topTens,
					totalEarnings: row.total_earnings
						? parseFloat(row.total_earnings)
						: null,
					totalLapsLed: Number(row.total_laps_led || 0),
					totalPoints: row.total_points ? Number(row.total_points) : null,
					totalRaces,
					winPercentage: totalRaces > 0 ? (wins / totalRaces) * 100 : 0,
					wins
				};
			} catch (error) {
				console.error('Error fetching team stats:', error);

				throw new Error('Could not fetch team stats.');
			}
		},

		teamsByFoundedYear: async (
			_parent: any,
			args: { year: number },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, manufacturer, owner, location, founded_year FROM teams WHERE founded_year = $1 ORDER BY name',
					[args.year]
				);
				return result.rows.map((row: any) => ({
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				}));
			} catch (error) {
				console.error(
					`Error fetching teams by founded year ${args.year}:`,
					error
				);
				throw new Error('Could not fetch teams by founded year.');
			}
		},

		/**
		 * Team filtering resolvers
		 */
		teamsByLocation: async (
			_parent: any,
			args: { location: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, manufacturer, owner, location, founded_year FROM teams WHERE location = $1 ORDER BY name',
					[args.location]
				);
				return result.rows.map((row: any) => ({
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				}));
			} catch (error) {
				console.error(
					`Error fetching teams by location ${args.location}:`,
					error
				);
				throw new Error('Could not fetch teams by location.');
			}
		},

		teamsByManufacturer: async (
			_parent: any,
			args: { manufacturer: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, manufacturer FROM teams WHERE manufacturer = $1 ORDER BY name',
					[args.manufacturer]
				);
				return result.rows;
			} catch (error) {
				console.error('Error fetching teams by manufacturer:', error);
				throw new Error('Could not fetch teams by manufacturer.');
			}
		},

		teamsByOwner: async (
			_parent: any,
			args: { owner: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, manufacturer, owner, location, founded_year FROM teams WHERE owner = $1 ORDER BY name',
					[args.owner]
				);
				return result.rows.map((row: any) => ({
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				}));
			} catch (error) {
				console.error(`Error fetching teams by owner ${args.owner}:`, error);
				throw new Error('Could not fetch teams by owner.');
			}
		},

		topEarners: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            d.id,
            CONCAT(d.first_name, ' ', d.last_name) as name,
            SUM(rr.prize_money) as total_earnings
          FROM race_results rr
          JOIN drivers d ON rr.driver_id = d.id
          JOIN events e ON rr.event_id = e.id
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' WHERE EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query +=
					' GROUP BY d.id, d.first_name, d.last_name ORDER BY total_earnings DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					id: row.id,
					name: row.name
				}));
			} catch (error) {
				console.error('Error fetching top earners:', error);
				throw new Error('Could not fetch top earners.');
			}
		},

		topPoleWinners: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            d.id,
            CONCAT(d.first_name, ' ', d.last_name) as name,
            COUNT(*) as poles
          FROM qualifying_results qr
          JOIN drivers d ON qr.driver_id = d.id
          JOIN events e ON qr.event_id = e.id
          WHERE qr.qualifying_position = 1
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query +=
					' GROUP BY d.id, d.first_name, d.last_name ORDER BY poles DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					id: row.id,
					name: row.name
				}));
			} catch (error) {
				console.error('Error fetching top pole winners:', error);
				throw new Error('Could not fetch top pole winners.');
			}
		},

		topRatedPerformances: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
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
          JOIN events e ON rr.event_id = e.id
          WHERE rr.driver_rating IS NOT NULL
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query += ' ORDER BY rr.driver_rating DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
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
				}));
			} catch (error) {
				console.error('Error fetching top rated performances:', error);
				throw new Error('Could not fetch top rated performances.');
			}
		},

		topSponsors: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            s.id,
            s.name,
            s.industry,
            s.website,
            COUNT(CASE WHEN rr.finish_position = 1 THEN 1 END) as wins
          FROM sponsors s
          JOIN race_results rr ON s.id = rr.sponsor_id
          JOIN events e ON rr.event_id = e.id
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' WHERE EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query +=
					' GROUP BY s.id, s.name, s.industry, s.website ORDER BY wins DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					id: row.id,
					industry: row.industry,
					name: row.name,
					website: row.website
				}));
			} catch (error) {
				console.error('Error fetching top sponsors:', error);
				throw new Error('Could not fetch top sponsors.');
			}
		},

		topStageWinners: async (
			_parent: any,
			args: { year?: number; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            d.id,
            CONCAT(d.first_name, ' ', d.last_name) as name,
            COUNT(*) as stage_wins
          FROM stage_results sr
          JOIN drivers d ON sr.driver_id = d.id
          JOIN events e ON sr.event_id = e.id
        `;
				const params: any[] = [];

				if (args.year) {
					query += ' WHERE EXTRACT(YEAR FROM e.event_date) = $1';
					params.push(args.year);
				}

				query +=
					' GROUP BY d.id, d.first_name, d.last_name ORDER BY stage_wins DESC';

				if (args.limit) {
					query += ` LIMIT $${params.length + 1}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					id: row.id,
					name: row.name
				}));
			} catch (error) {
				console.error('Error fetching top stage winners:', error);
				throw new Error('Could not fetch top stage winners.');
			}
		},

		/**
		 * Resolver for the "track" query.
		 * Fetches a single track by their unique ID.
		 */
		track: async (_parent: any, args: { id: string }, context: MyContext) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE id = $1',
					[args.id]
				);
				if (result.rows.length === 0) {
					throw new NotFoundError('Track', args.id);
				}
				const row = result.rows[0];
				return {
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				};
			} catch (error) {
				if (error instanceof NotFoundError) {
					throw error;
				}
				console.error(`Error fetching track with id ${args.id}:`, error);
				throw new Error('Could not fetch track.');
			}
		},

		/**
		 * Caution and incident analytics resolvers
		 */
		trackCautionStats: async (
			_parent: any,
			args: { trackId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            COUNT(rc.id) as total_cautions,
            SUM(rc.laps_under_caution) as total_caution_laps,
            AVG(rc.laps_under_caution) as avg_caution_laps,
            COUNT(DISTINCT e.id) as races
          FROM race_cautions rc
          JOIN events e ON rc.event_id = e.id
          WHERE e.track_id = $1
        `;
				const params: any[] = [args.trackId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				const totalCautions = Number(row.total_cautions || 0);
				const totalCautionLaps = Number(row.total_caution_laps || 0);
				const races = Number(row.races || 0);

				return {
					avgCautionLaps: row.avg_caution_laps
						? parseFloat(row.avg_caution_laps)
						: null,
					avgCautions: races > 0 ? totalCautions / races : 0,
					cautionPercentage: null, // Would need total race laps to calculate
					races,
					totalCautionLaps,
					totalCautions
				};
			} catch (error) {
				console.error('Error fetching track caution stats:', error);
				throw new Error('Could not fetch track caution stats.');
			}
		},

		/**
		 * Race dynamics analytics resolvers
		 */
		trackDynamicsStats: async (
			_parent: any,
			args: { trackId: string; year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            AVG(e.lead_changes) as avg_lead_changes,
            AVG(e.different_leaders) as avg_different_leaders,
            MAX(e.lead_changes) as max_lead_changes,
            MAX(e.different_leaders) as max_different_leaders,
            COUNT(*) as races
          FROM events e
          WHERE e.track_id = $1 AND e.lead_changes IS NOT NULL
        `;
				const params: any[] = [args.trackId];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				const result = await context.db.query(query, params);
				const row = result.rows[0];

				return {
					avgDifferentLeaders: row.avg_different_leaders
						? parseFloat(row.avg_different_leaders)
						: null,
					avgLeadChanges: row.avg_lead_changes
						? parseFloat(row.avg_lead_changes)
						: null,
					maxDifferentLeaders: row.max_different_leaders
						? Number(row.max_different_leaders)
						: null,
					maxLeadChanges: row.max_lead_changes
						? Number(row.max_lead_changes)
						: null,
					races: Number(row.races || 0)
				};
			} catch (error) {
				console.error('Error fetching track dynamics stats:', error);
				throw new Error('Could not fetch track dynamics stats.');
			}
		},

		/**
		 * Track analytics resolver
		 */
		trackStats: async (
			_parent: any,
			args: { trackId: string; year?: number; seriesId?: string },
			context: MyContext
		) => {
			try {
				let baseQuery = `
          FROM events e
          LEFT JOIN race_cautions rc ON e.id = rc.event_id
          LEFT JOIN race_results rr ON e.id = rr.event_id
          WHERE e.track_id = $1
        `;
				const params: any[] = [args.trackId];
				let paramIndex = 2;

				if (args.year) {
					baseQuery += ` AND EXTRACT(YEAR FROM e.event_date) = $${paramIndex}`;
					params.push(args.year);
					paramIndex++;
				}

				if (args.seriesId) {
					baseQuery += ` AND e.series_id = $${paramIndex}`;
					params.push(args.seriesId);
					paramIndex++;
				}

				/** Get basic race statistics */
				const raceStatsQuery = `
          SELECT 
            COUNT(DISTINCT e.id) as total_races,
            AVG(e.lead_changes) as avg_lead_changes,
            AVG(e.different_leaders) as avg_different_leaders
          ${baseQuery}
        `;

				/** Get caution statistics */
				const cautionStatsQuery = `
          SELECT 
            AVG(caution_count) as avg_cautions,
            AVG(caution_laps) as avg_caution_laps
          FROM (
            SELECT 
              e.id,
              COUNT(rc.id) as caution_count,
              SUM(rc.laps_under_caution) as caution_laps
            ${baseQuery}
            GROUP BY e.id
          ) caution_summary
        `;

				/** Get manufacturer statistics */
				const manufacturerQuery = `
          SELECT 
            rr.manufacturer,
            COUNT(*) as wins
          ${baseQuery}
          AND rr.finish_position = 1
          AND rr.manufacturer IS NOT NULL
          GROUP BY rr.manufacturer
          ORDER BY wins DESC
          LIMIT 1
        `;

				/** Get driver performance statistics */
				const driverStatsQuery = `
          SELECT 
            AVG(rr.finish_position::numeric) as avg_finish_position,
            AVG(rr.driver_rating) as avg_driver_rating,
            AVG(rr.pit_stops::numeric) as avg_pit_stops
          ${baseQuery}
          AND rr.finish_position IS NOT NULL
        `;

				/** Get top caution reason */
				const cautionReasonQuery = `
          SELECT 
            rc.reason,
            COUNT(*) as reason_count
          ${baseQuery}
          AND rc.reason IS NOT NULL
          GROUP BY rc.reason
          ORDER BY reason_count DESC
          LIMIT 1
        `;

				/** Execute all queries */
				const [
					raceStats,
					cautionStats,
					manufacturerStats,
					driverStats,
					cautionReason
				] = await Promise.all([
					context.db.query(raceStatsQuery, params),
					context.db.query(cautionStatsQuery, params),
					context.db.query(manufacturerQuery, params),
					context.db.query(driverStatsQuery, params),
					context.db.query(cautionReasonQuery, params)
				]);

				const raceRow = raceStats.rows[0];
				const cautionRow = cautionStats.rows[0];
				const manufacturerRow = manufacturerStats.rows[0];
				const driverRow = driverStats.rows[0];
				const cautionReasonRow = cautionReason.rows[0];

				/** Calculate competitiveness score (0-100 based on lead changes and leaders) */
				const avgLeadChanges = raceRow.avg_lead_changes
					? parseFloat(raceRow.avg_lead_changes)
					: 0;
				const avgDifferentLeaders = raceRow.avg_different_leaders
					? parseFloat(raceRow.avg_different_leaders)
					: 0;
				const competitivenessScore = Math.min(
					100,
					avgLeadChanges * 2 + avgDifferentLeaders * 5
				);

				return {
					avgCautionLaps: cautionRow.avg_caution_laps
						? parseFloat(cautionRow.avg_caution_laps)
						: null,
					avgCautions: cautionRow.avg_cautions
						? parseFloat(cautionRow.avg_cautions)
						: null,
					avgDifferentLeaders: avgDifferentLeaders || null,
					avgDriverRating: driverRow.avg_driver_rating
						? parseFloat(driverRow.avg_driver_rating)
						: null,
					avgFinishPosition: driverRow.avg_finish_position
						? parseFloat(driverRow.avg_finish_position)
						: null,
					avgLeadChanges: avgLeadChanges || null,
					avgPitStops: driverRow.avg_pit_stops
						? parseFloat(driverRow.avg_pit_stops)
						: null,
					competitivenessScore: competitivenessScore || null,
					topCautionReason: cautionReasonRow?.reason || null,
					topWinningManufacturer: manufacturerRow?.manufacturer || null,
					totalRaces: Number(raceRow.total_races || 0)
				};
			} catch (error) {
				console.error('Error fetching track analytics:', error);
				throw new Error('Could not fetch track analytics.');
			}
		},

		/**
		 * Resolver for the "tracks" query with filtering.
		 */
		tracks: async (
			_parent: any,
			args: { filter?: any },
			context: MyContext
		) => {
			try {
				let query =
					'SELECT id, name, city, state, length_miles, type, surface FROM tracks';
				const conditions = [];
				const params: any[] = [];

				if (args.filter) {
					if (args.filter.type) {
						conditions.push(`type = $${params.length + 1}`);
						params.push(args.filter.type);
					}
					if (args.filter.surface) {
						conditions.push(`surface = $${params.length + 1}`);
						params.push(args.filter.surface);
					}
					if (args.filter.state) {
						conditions.push(`state = $${params.length + 1}`);
						params.push(args.filter.state);
					}
					if (args.filter.minLength) {
						conditions.push(`length_miles >= $${params.length + 1}`);
						params.push(args.filter.minLength);
					}
					if (args.filter.maxLength) {
						conditions.push(`length_miles <= $${params.length + 1}`);
						params.push(args.filter.maxLength);
					}
				}

				if (conditions.length > 0) {
					query += ' WHERE ' + conditions.join(' AND ');
				}
				query += ' ORDER BY name';

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error('Error fetching tracks:', error);

				throw new Error('Could not fetch tracks.');
			}
		},

		tracksByState: async (
			_parent: any,
			args: { state: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE state = $1 ORDER BY name',
					[args.state]
				);
				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error('Error fetching tracks by state:', error);

				throw new Error('Could not fetch tracks by state.');
			}
		},

		tracksBySurface: async (
			_parent: any,
			args: { surface: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE surface = $1 ORDER BY name',
					[args.surface]
				);
				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error('Error fetching tracks by surface:', error);

				throw new Error('Could not fetch tracks by surface.');
			}
		},

		/**
		 * Advanced track queries
		 */
		tracksByType: async (
			_parent: any,
			args: { type: string },
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, city, state, length_miles, type, surface FROM tracks WHERE type = $1 ORDER BY name',
					[args.type]
				);
				return result.rows.map((row: any) => ({
					city: row.city,
					id: row.id,
					lengthMiles: row.length_miles,
					name: row.name,
					state: row.state,
					surface: row.surface,
					type: row.type
				}));
			} catch (error) {
				console.error('Error fetching tracks by type:', error);

				throw new Error('Could not fetch tracks by type.');
			}
		}
	},

	Race: {
		/**
		 * Resolver for the "cautions" field on the Race type.
		 * Uses DataLoader to batch fetch race cautions and eliminate N+1 queries.
		 */
		cautions: async (
			parent: { id: string },
			_args: any,
			context: MyContext
		) => {
			try {
				return await context.dataloaders.raceCautionsLoader.load(parent.id);
			} catch (error) {
				console.error(`Error fetching cautions for race ${parent.id}:`, error);
				throw new Error('Could not fetch race cautions.');
			}
		},

		/**
		 * Resolver for the "practiceSessions" field on the Race type.
		 * Supports filtering by session name with pagination.
		 */
		practiceSessions: async (
			parent: { id: string },
			args: { sessionName?: string; limit?: number; offset?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            ps.id,
            ps.session_name,
            ps.session_date,
            ps.session_duration
          FROM practice_sessions ps
          WHERE ps.event_id = $1
        `;

				const params: any[] = [parent.id];
				let paramIndex = 2;

				/** Apply session name filter */
				if (args.sessionName) {
					query += ` AND ps.session_name = $${paramIndex}`;
					params.push(args.sessionName);
					paramIndex++;
				}

				query += ' ORDER BY ps.session_date ASC';

				/** Apply pagination */
				if (args.limit) {
					query += ` LIMIT $${paramIndex}`;
					params.push(args.limit);
					paramIndex++;
				}

				if (args.offset) {
					query += ` OFFSET $${paramIndex}`;
					params.push(args.offset);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					id: row.id,
					sessionDate: row.session_date,
					sessionDuration: row.session_duration,
					sessionName: row.session_name
				}));
			} catch (error) {
				console.error(
					`Error fetching practice sessions for race ${parent.id}:`,
					error
				);

				throw new Error('Could not fetch practice sessions.');
			}
		},

		/**
		 * Resolver for the "qualifyingResults" field on the Race type.
		 * Uses DataLoader to batch fetch qualifying results and eliminate N+1 queries.
		 */
		qualifyingResults: async (
			parent: { id: string },
			_args: any,
			context: MyContext
		) => {
			try {
				return await context.dataloaders.qualifyingResultsLoader.load(
					parent.id
				);
			} catch (error) {
				console.error(
					`Error fetching qualifying results for race ${parent.id}:`,
					error
				);

				throw new Error('Could not fetch qualifying results.');
			}
		},

		/**
		 * Resolver for the "results" field on the Race type.
		 * Supports advanced filtering and sorting of race results.
		 */
		results: async (
			parent: { id: string },
			args: { filter?: any; sort?: any; limit?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
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
            rr.fastest_laps,
            rr.passes_made,
            rr.quality_passes,
            rr.avg_running_position,
            rr.sponsor_id,
            d.id as driver_id,
            CONCAT(d.first_name, ' ', d.last_name) as driver_name,
            t.id as team_id,
            t.name as team_name,
            s.id as sponsor_id_full,
            s.name as sponsor_name,
            s.industry as sponsor_industry,
            s.website as sponsor_website
          FROM race_results rr
          JOIN drivers d ON rr.driver_id = d.id
          JOIN teams t ON rr.team_id = t.id
          LEFT JOIN sponsors s ON rr.sponsor_id = s.id
          WHERE rr.event_id = $1
        `;

				const params: any[] = [parent.id];
				let paramIndex = 2;

				/** Apply filters */
				if (args.filter) {
					if (args.filter.manufacturer) {
						query += ` AND rr.manufacturer = $${paramIndex}`;
						params.push(args.filter.manufacturer);
						paramIndex++;
					}

					if (args.filter.teamId) {
						query += ` AND rr.team_id = $${paramIndex}`;
						params.push(args.filter.teamId);
						paramIndex++;
					}

					if (args.filter.driverId) {
						query += ` AND rr.driver_id = $${paramIndex}`;
						params.push(args.filter.driverId);
						paramIndex++;
					}

					if (args.filter.finishPositionMin) {
						query += ` AND rr.finish_position >= $${paramIndex}`;
						params.push(args.filter.finishPositionMin);
						paramIndex++;
					}

					if (args.filter.finishPositionMax) {
						query += ` AND rr.finish_position <= $${paramIndex}`;
						params.push(args.filter.finishPositionMax);
						paramIndex++;
					}

					if (args.filter.startPositionMin) {
						query += ` AND rr.start_position >= $${paramIndex}`;
						params.push(args.filter.startPositionMin);
						paramIndex++;
					}

					if (args.filter.startPositionMax) {
						query += ` AND rr.start_position <= $${paramIndex}`;
						params.push(args.filter.startPositionMax);
						paramIndex++;
					}

					if (args.filter.status) {
						query += ` AND rr.status = $${paramIndex}`;
						params.push(args.filter.status);
						paramIndex++;
					}
				}

				/** Apply sorting */
				if (args.sort) {
					const sortField = args.sort.field;
					const sortDirection = args.sort.direction || 'ASC';

					let dbField = 'rr.finish_position'; // default
					switch (sortField) {
						case 'FINISH_POSITION':
							dbField = 'rr.finish_position';
							break;
						case 'START_POSITION':
							dbField = 'rr.start_position';
							break;
						case 'LAPS_LED':
							dbField = 'rr.laps_led';
							break;
						case 'LAPS_COMPLETED':
							dbField = 'rr.laps_completed';
							break;
						case 'POINTS':
							dbField = 'rr.points';
							break;
						case 'PRIZE_MONEY':
							dbField = 'rr.prize_money';
							break;
						case 'DRIVER_RATING':
							dbField = 'rr.driver_rating';
							break;
						case 'PIT_STOPS':
							dbField = 'rr.pit_stops';
							break;
						case 'FASTEST_LAPS':
							dbField = 'rr.fastest_laps';
							break;
						case 'PASSES_MADE':
							dbField = 'rr.passes_made';
							break;
						case 'QUALITY_PASSES':
							dbField = 'rr.quality_passes';
							break;
						case 'AVG_RUNNING_POSITION':
							dbField = 'rr.avg_running_position';
							break;
					}

					query += ` ORDER BY ${dbField} ${sortDirection}`;
				} else {
					query += ' ORDER BY rr.finish_position ASC';
				}

				// Apply limit
				if (args.limit) {
					query += ` LIMIT $${paramIndex}`;
					params.push(args.limit);
				}

				const result = await context.db.query(query, params);

				return result.rows.map((row: any) => ({
					avgRunningPosition: row.avg_running_position
						? parseFloat(row.avg_running_position)
						: null,
					carNumber: row.car_number,
					driver: {
						id: row.driver_id,
						name: row.driver_name
					},
					driverRating: row.driver_rating
						? parseFloat(row.driver_rating)
						: null,
					fastestLaps: row.fastest_laps,
					finishPosition: row.finish_position,
					id: row.id,
					lapsCompleted: row.laps_completed,
					lapsLed: row.laps_led,
					manufacturer: row.manufacturer,
					passesMade: row.passes_made,
					pitStops: row.pit_stops,
					points: row.points,
					prizeMoney: row.prize_money ? parseFloat(row.prize_money) : null,
					qualityPasses: row.quality_passes,
					sponsor: row.sponsor_id_full
						? {
								id: row.sponsor_id_full,
								industry: row.sponsor_industry,
								name: row.sponsor_name,
								website: row.sponsor_website
							}
						: null,
					startPosition: row.start_position,
					status: row.status,
					team: {
						id: row.team_id,
						name: row.team_name
					}
				}));
			} catch (error) {
				console.error(
					`Error fetching filtered results for race ${parent.id}: ${error}`
				);

				throw new Error('Could not fetch race results.');
			}
		},
		/**
		 * Resolver for the "series" field on the Race type.
		 */
		series: async (
			parent: { series_id: string },
			_args: any,
			context: MyContext
		) => {
			try {
				const result = await context.db.query(
					'SELECT id, name, full_name, abbreviation FROM series WHERE id = $1',
					[parent.series_id]
				);

				if (result.rows.length === 0) {
					throw new Error(`Series with ID ${parent.series_id} not found`);
				}

				const row = result.rows[0];

				return {
					abbreviation: row.abbreviation,
					fullName: row.full_name,
					id: row.id,
					name: row.name
				};
			} catch (error) {
				console.error(
					`Error fetching series for race ${parent.series_id}: ${error}`
				);

				throw new Error('Could not fetch race series.');
			}
		},

		/**
		 * Resolver for the "stageResults" field on the Race type.
		 * Uses DataLoader to batch fetch stage results and eliminate N+1 queries.
		 */
		stageResults: async (
			parent: { id: string },
			_args: any,
			context: MyContext
		) => {
			try {
				return await context.dataloaders.stageResultsLoader.load(parent.id);
			} catch (error) {
				console.error(
					`Error fetching stage results for race ${parent.id}: ${error}`
				);

				throw new Error('Could not fetch stage results.');
			}
		},

		/**
		 * Resolver for the "track" field on the Race type.
		 * Uses DataLoader to batch fetch tracks and eliminate N+1 queries.
		 */
		track: async (
			parent: { track_id: string },
			_args: any,
			context: MyContext
		) => {
			try {
				return await context.dataloaders.tracksLoader.load(parent.track_id);
			} catch (error) {
				console.error(
					`Error fetching track for race ${parent.track_id}: ${error}`
				);

				throw new Error('Could not fetch race track.');
			}
		}
	},

	Team: {
		/**
		 * Resolver for the "races" field on the Team type.
		 * Uses DataLoader to batch fetch races and eliminate N+1 queries.
		 */
		races: async (parent: { id: string }, _args: any, context: MyContext) => {
			try {
				return await context.dataloaders.teamRacesLoader.load(parent.id);
			} catch (error) {
				console.error(`Error fetching races for team ${parent.id}: ${error}`);

				throw new Error('Could not fetch team races.');
			}
		}
	},

	Track: {
		/**
		 * Resolver for the "drivers" field on the Track type.
		 * Supports filtering by year.
		 */
		drivers: async (
			parent: { id: string },
			args: { year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT DISTINCT
            d.id,
            CONCAT(d.first_name, ' ', d.last_name) as name,
            d.date_of_birth,
            d.hometown
          FROM drivers d
          JOIN race_results rr ON d.id = rr.driver_id
          JOIN events e ON rr.event_id = e.id
          WHERE e.track_id = $1
        `;

				const params: any[] = [parent.id];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				query += ' ORDER BY d.first_name, d.last_name';

				const result = await context.db.query(query, params);

				return result.rows.map((row: any) => ({
					dateOfBirth: row.date_of_birth,
					hometown: row.hometown,
					id: row.id,
					name: row.name
				}));
			} catch (error) {
				console.error(
					`Error fetching drivers for track ${parent.id}: ${error}`
				);

				throw new Error('Could not fetch track drivers.');
			}
		},
		/**
		 * Resolver for the "races" field on the Track type.
		 * Supports filtering by year with pagination.
		 */
		races: async (
			parent: { id: string },
			args: { year?: number; limit?: number; offset?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT 
            e.id,
            e.name,
            e.track_id,
            e.event_date,
            e.lead_changes,
            e.different_leaders
          FROM events e
          WHERE e.track_id = $1
        `;

				const params: any[] = [parent.id];
				let paramIndex = 2;

				/** Apply year filter */
				if (args.year) {
					query += ` AND EXTRACT(YEAR FROM e.event_date) = $${paramIndex}`;
					params.push(args.year);
					paramIndex++;
				}

				query += ' ORDER BY e.event_date DESC';

				/** Apply pagination */
				if (args.limit) {
					query += ` LIMIT $${paramIndex}`;
					params.push(args.limit);
					paramIndex++;
				}

				if (args.offset) {
					query += ` OFFSET $${paramIndex}`;
					params.push(args.offset);
				}

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					differentLeaders: row.different_leaders,
					event_date: row.event_date,
					id: row.id,
					leadChanges: row.lead_changes,
					name: row.name,
					track_id: row.track_id
				}));
			} catch (error) {
				console.error(`Error fetching races for track ${parent.id}: ${error}`);

				throw new Error('Could not fetch track races.');
			}
		},

		/**
		 * Resolver for track statistics with optional driver/team filtering.
		 */
		stats: async (
			parent: { id: string },
			args: { driverId?: string; teamId?: string },
			context: MyContext
		) => {
			try {
				const key = `${parent.id}|${args.driverId || 'null'}|${args.teamId || 'null'}`;
				return await context.dataloaders.trackStatsLoader.load(key);
			} catch (error) {
				console.error(`Error fetching stats for track ${parent.id}: ${error}`);

				throw new Error('Could not fetch track stats.');
			}
		},

		/**
		 * Resolver for the "teams" field on the Track type.
		 * Supports filtering by year.
		 */
		teams: async (
			parent: { id: string },
			args: { year?: number },
			context: MyContext
		) => {
			try {
				let query = `
          SELECT DISTINCT
            t.id,
            t.name,
            t.manufacturer,
            t.owner,
            t.location,
            t.founded_year
          FROM teams t
          JOIN race_results rr ON t.id = rr.team_id
          JOIN events e ON rr.event_id = e.id
          WHERE e.track_id = $1
        `;

				const params: any[] = [parent.id];

				if (args.year) {
					query += ' AND EXTRACT(YEAR FROM e.event_date) = $2';
					params.push(args.year);
				}

				query += ' ORDER BY t.name';

				const result = await context.db.query(query, params);
				return result.rows.map((row: any) => ({
					foundedYear: row.founded_year,
					id: row.id,
					location: row.location,
					manufacturer: row.manufacturer,
					name: row.name,
					owner: row.owner
				}));
			} catch (error) {
				console.error(`Error fetching teams for track ${parent.id}: ${error}`);

				throw new Error('Could not fetch track teams.');
			}
		}
	}
};

import * as cheerio from 'cheerio';
import 'dotenv/config';
import { pool } from './src/database';
import { ProxyScraper } from './src/scrapers/proxy-scraper';

const proxyScraper = new ProxyScraper({
	enabled: process.env.PROXY_ENABLED === 'true',
	password: process.env.OXYLABS_PASSWORD || '',
	username: process.env.OXYLABS_USERNAME || ''
});

async function scrapeComprehensiveNASCAR() {
	console.log('🏁 Starting comprehensive NASCAR data scraping...');

	await Promise.all([
		scrapeCurrentStandings(),
		scrapeRecentRaces(),
		scrapeDriverStats(),
		scrapeSchedule()
	]);

	await generateSummary();
}

async function scrapeCurrentStandings() {
	console.log('\n📊 Scraping current standings...');

	const urls = [
		'https://www.nascar.com/standings/cup-series/',
		'https://www.racing-reference.info/standings/2024/W/'
	];

	for (const url of urls) {
		try {
			const html = await proxyScraper.scrapeWithRetry(url);
			const $ = cheerio.load(html);

			$('.standings-table tbody tr, .data-table tbody tr').each((i, row) => {
				const $row = $(row);
				const position = i + 1;
				const driverName = $row
					.find('.driver-name, td:nth-child(2)')
					.text()
					.trim();
				const points =
					Number(
						$row.find('.points, td:nth-child(3)').text().replace(/,/g, '')
					) || 0;
				const wins = Number($row.find('.wins, td:nth-child(4)').text()) || 0;

				if (driverName) {
					console.log(
						`  ${position}. ${driverName} - ${points} pts, ${wins} wins`
					);
				}
			});

			break; // Success, exit loop
		} catch (error) {
			console.log(`Failed to scrape standings from ${url} --> ${error}`);
		}
	}
}

async function scrapeRecentRaces() {
	console.log('\n🏆 Scraping recent race results...');

	const races = [
		'https://www.nascar.com/results/racecenter/2024/phoenix-championship/',
		'https://www.nascar.com/results/racecenter/2024/martinsville-xfinity-500/',
		'https://www.nascar.com/results/racecenter/2024/homestead-dixie-vodka-400/'
	];

	for (const raceUrl of races) {
		try {
			const html = await proxyScraper.scrapeWithRetry(raceUrl);
			const $ = cheerio.load(html);

			const raceName = $('.race-title, h1').first().text().trim();
			console.log(`\n  📍 ${raceName}:`);

			$('.results-table tbody tr')
				.slice(0, 5)
				.each((i, row) => {
					const $row = $(row);
					const position = $row.find('td:first-child').text().trim();
					const driver = $row.find('.driver-name').text().trim();
					const carNumber = $row.find('.car-number').text().trim();

					if (driver) {
						console.log(`    ${position}. #${carNumber} ${driver}`);
					}
				});

			await new Promise((resolve) => setTimeout(resolve, 2000));
		} catch (error) {
			console.log(`Failed to scrape race: ${raceUrl}`);
		}
	}
}

async function scrapeDriverStats() {
	console.log('\n👨‍🏁 Scraping driver statistics...');

	const topDrivers = [
		'joey-logano',
		'ryan-blaney',
		'william-byron',
		'christopher-bell',
		'tyler-reddick',
		'denny-hamlin',
		'chase-elliott',
		'kyle-larson'
	];

	for (const driver of topDrivers) {
		try {
			const url = `https://www.nascar.com/drivers/${driver}/`;
			const html = await proxyScraper.scrapeWithRetry(url);
			const $ = cheerio.load(html);

			const name = $('.driver-name, h1').first().text().trim();
			const wins = $('.stat-wins, .wins').text().trim();
			const poles = $('.stat-poles, .poles').text().trim();
			const championships = $('.stat-championships, .championships')
				.text()
				.trim();

			console.log(
				`  ${name}: ${wins} wins, ${poles} poles, ${championships} championships`
			);

			await new Promise((resolve) => setTimeout(resolve, 1500));
		} catch (error) {
			console.log(`Failed to scrape driver stats for ${driver}`);
		}
	}
}

async function scrapeSchedule() {
	console.log('\n📅 Scraping 2025 schedule...');

	try {
		const html = await proxyScraper.scrapeWithRetry(
			'https://www.nascar.com/schedule/cup-series/'
		);
		const $ = cheerio.load(html);

		$('.schedule-table tbody tr, .race-weekend')
			.slice(0, 10)
			.each((i, row) => {
				const $row = $(row);
				const date = $row.find('.date, .race-date').text().trim();
				const track = $row.find('.track, .race-track').text().trim();
				const raceName = $row.find('.race-name, .event-name').text().trim();

				if (track && raceName) {
					console.log(`  ${date}: ${raceName} at ${track}`);
				}
			});
	} catch (error) {
		console.log('Failed to scrape schedule');
	}
}

async function generateSummary() {
	const client = await pool.connect();

	try {
		console.log('\n' + '='.repeat(60));
		console.log('🏁 COMPREHENSIVE NASCAR DATA SUMMARY');
		console.log('='.repeat(60));

		// Database stats
		const stats = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM drivers) as drivers,
        (SELECT COUNT(*) FROM teams) as teams,
        (SELECT COUNT(*) FROM events) as events,
        (SELECT COUNT(*) FROM race_results) as results,
        (SELECT COUNT(*) FROM paint_schemes) as paint_schemes
    `);

		const data = stats.rows[0];
		console.log(`📊 Database Statistics:`);
		console.log(`   Drivers: ${data.drivers}`);
		console.log(`   Teams: ${data.teams}`);
		console.log(`   Events: ${data.events}`);
		console.log(`   Race Results: ${data.results}`);
		console.log(`   Paint Schemes: ${data.paint_schemes}`);

		// Recent activity
		const recentResults = await client.query(`
      SELECT 
        e.name as race_name,
        d.first_name || ' ' || d.last_name as winner,
        rr.car_number
      FROM race_results rr
      JOIN events e ON rr.event_id = e.id
      JOIN drivers d ON rr.driver_id = d.id
      WHERE rr.finish_position = 1
      ORDER BY e.event_date DESC
      LIMIT 5
    `);

		console.log(`\n🏆 Recent Winners:`);
		recentResults.rows.forEach((row) => {
			console.log(`   ${row.race_name}: #${row.car_number} ${row.winner}`);
		});

		console.log('\n✅ Comprehensive NASCAR data scraping complete!');
		console.log('📊 Database ready for API deployment');
	} finally {
		client.release();
		await pool.end();
	}
}

scrapeComprehensiveNASCAR();

import * as cheerio from 'cheerio';
import 'dotenv/config';
import { pool } from './src/database';

interface ScrapeOptions {
	years?: number[];
	teams?: string[];
	carNumbers?: string[];
	maxSchemes?: number;
}

async function scrapeDynamicPaintSchemes(options: ScrapeOptions = {}) {
	const {
		years = [
			new Date().getFullYear(),
			new Date().getFullYear() - 1,
			new Date().getFullYear() - 2
		],
		teams = [
			'23xi-racing',
			'front-row-motorsports',
			'haas-factory-team',
			'hendrick-motorsports',
			'hya-motorsports',
			'joe-gibbs-racing',
			'jr-motorsports',
			'kyle-busch-motorsports',
			'legacy-motorsports',
			'levine-motorsports',
			'michael-carson-motorsports',
			'michael-walter-motorsports',
			'petty-gmr-motorsports',
			'rfk-racing',
			'richard-childress-racing',
			'rick-ware-racing',
			'roush-fenway-keselowski-racing',
			'ryan-newman-motorsports',
			'stewart-haas-racing',
			'team-penske',
			'trackhouse-racing',
			'wood-brothers-racing',
			'kaulig-racing',
			'niece-motorsports',
			'spire-motorsports',
			'thorsport-racing'
		],
		carNumbers = [
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
			'10',
			'11',
			'12',
			'14',
			'16',
			'17',
			'18',
			'19',
			'20',
			'21',
			'22',
			'23',
			'24',
			'33',
			'34',
			'35',
			'38',
			'41',
			'42',
			'43',
			'44',
			'45',
			'47',
			'48',
			'51',
			'54',
			'60',
			'66',
			'71',
			'77',
			'78',
			'66',
			'88',
			'99'
		],
		maxSchemes = 100
	} = options;

	console.log(`🎨 Starting dynamic paint scheme scraping...`);
	console.log(`📅 Years: ${years.join(', ')}`);
	console.log(`🏢 Teams: ${teams.length} teams`);
	console.log(`🏎️ Car numbers: ${carNumbers.length} cars`);

	let totalSchemes = 0;

	for (const year of years) {
		if (totalSchemes >= maxSchemes) break;

		console.log(`\n📅 Scraping ${year}...`);

		for (const team of teams) {
			if (totalSchemes >= maxSchemes) break;

			for (const carNum of carNumbers) {
				if (totalSchemes >= maxSchemes) break;

				const url = `https://www.jayski.com/paint-schemes/cup-series-paint-schemes/${year}-nascar-cup-series-${carNum}-${team}-paint-schemes/`;

				try {
					const response = await fetch(url);

					if (response.ok) {
						const html = await response.text();
						const schemes = extractSchemes(html, carNum, year);

						if (schemes.length > 0) {
							await saveSchemes(schemes, year);

							totalSchemes += schemes.length;

							console.log(`  ✅ #${carNum} ${team}: ${schemes.length} schemes`);
						}
					}

					await new Promise((resolve) => setTimeout(resolve, 1000));
				} catch (error) {
					console.log(`  ⚠️ Failed #${carNum} ${team}`);
				}
			}
		}
	}

	console.log(`\n🏁 Scraping complete! Total schemes: ${totalSchemes}`);

	await showResults();
}

function extractSchemes(html: string, carNumber: string, year: number) {
	const $ = cheerio.load(html);
	const schemes: any[] = [];

	$('img').each((_, img) => {
		const src = $(img).attr('src') || '';
		const alt = $(img).attr('alt') || '';

		if (
			src.includes('paint') ||
			src.includes('scheme') ||
			alt.includes(carNumber)
		) {
			const $context = $(img).closest('div, figure, p').parent();
			const text = `${$context.text()} ${alt}`;

			const sponsorMatch = text.match(/(?:sponsored by|featuring)\s+([^.]+)/i);
			const sponsor = sponsorMatch?.[1]?.trim() || '';

			const driverMatch = text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
			const driverName = driverMatch?.[1] || '';

			let schemeType = 'regular';
			if (text.toLowerCase().includes('throwback')) schemeType = 'throwback';
			else if (text.toLowerCase().includes('special')) schemeType = 'special';

			schemes.push({
				carNumber,
				driverName,
				imageUrl: src.startsWith('http') ? src : `https://www.jayski.com${src}`,
				primarySponsor: sponsor,
				schemeType,
				year
			});
		}
	});

	return schemes;
}

async function saveSchemes(schemes: any[], year: number) {
	const client = await pool.connect();

	try {
		for (const scheme of schemes) {
			const driverId = scheme.driverName
				? scheme.driverName
						.toLowerCase()
						.replace(/\s+/g, '_')
						.replace(/[^a-z0-9_]/g, '')
				: `driver_${scheme.carNumber}`;

			const [firstName, ...lastNameParts] = (scheme.driverName || '').split(
				' '
			);
			const lastName = lastNameParts.join(' ') || '';

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
        INSERT INTO paint_schemes 
        (event_id, driver_id, car_number, primary_sponsor, scheme_type, scheme_image_url, year)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (event_id, driver_id) 
        DO UPDATE SET 
          primary_sponsor = COALESCE(NULLIF($4, ''), paint_schemes.primary_sponsor),
          scheme_image_url = $6,
          year = $7
      `,
				[
					`season_${year}`,
					driverId,
					scheme.carNumber,
					scheme.primarySponsor,
					scheme.schemeType,
					scheme.imageUrl,
					year
				]
			);
		}
	} finally {
		client.release();
	}
}

async function showResults() {
	const client = await pool.connect();

	try {
		const result = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT car_number) as cars,
        COUNT(DISTINCT year) as years,
        COUNT(DISTINCT primary_sponsor) as sponsors
      FROM paint_schemes
    `);

		console.log('\n📊 DYNAMIC SCRAPING RESULTS:');
		console.log(`Total schemes: ${result.rows[0].total}`);
		console.log(`Car numbers: ${result.rows[0].cars}`);
		console.log(`Years covered: ${result.rows[0].years}`);
		console.log(`Sponsors: ${result.rows[0].sponsors}`);
	} finally {
		client.release();
		await pool.end();
	}
}

// CLI argument parsing
const args = process.argv.slice(2);
const options: ScrapeOptions = {};

for (let i = 0; i < args.length; i++) {
	switch (args[i]) {
		case '--years':
			options.years = args[++i].split(',').map(Number);
			break;
		case '--teams':
			options.teams = args[++i].split(',');
			break;
		case '--cars':
			options.carNumbers = args[++i].split(',');
			break;
		case '--max':
			options.maxSchemes = Number(args[++i]);
			break;
	}
}

scrapeDynamicPaintSchemes(options);

import 'dotenv/config';
import { pool } from './src/database';
import * as cheerio from 'cheerio';

interface RaceConfig {
  years?: number[];
  series?: string[];
  maxRaces?: number;
  sources?: string[];
}

const RACE_SOURCES = {
  nascar: (year: number, race: string) => `https://www.nascar.com/results/racecenter/${year}/${race}/`,
  racing_reference: (year: number, track: string) => `https://www.racing-reference.info/race-results/${year}/${track}/`,
  jayski: (year: number, race: string) => `https://www.jayski.com/nascar-cup-series/${year}-results/${race}/`
};

async function scrapeDynamicRaces(config: RaceConfig = {}) {
  const {
    years = [new Date().getFullYear(), new Date().getFullYear() - 1],
    series = ['cup-series'],
    maxRaces = 50,
    sources = ['nascar', 'racing_reference']
  } = config;

  console.log(`🏁 Starting dynamic race scraping...`);
  console.log(`📅 Years: ${years.join(', ')}`);
  console.log(`🏆 Series: ${series.join(', ')}`);
  console.log(`📊 Max races: ${maxRaces}`);

  const raceTemplates = await generateRaceList(years);
  let totalResults = 0;

  for (const race of raceTemplates.slice(0, maxRaces)) {
    console.log(`\n🏆 Scraping ${race.name} ${race.year}...`);

    for (const source of sources) {
      try {
        const url = generateRaceUrl(source, race);
        const html = await fetchRaceData(url);
        const results = extractRaceResults(html, race);

        if (results.length > 0) {
          await saveRaceResults(results, race);
          totalResults += results.length;
          console.log(`  ✅ ${source}: ${results.length} results`);
          break;
        }

      } catch (error) {
        console.log(`  ⚠️ ${source}: Failed`);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  console.log(`\n🏁 Dynamic scraping complete! Total results: ${totalResults}`);
  await showRaceResults();
}

async function generateRaceList(years: number[]) {
  const races = [];
  
  const raceTemplates = [
    { name: 'daytona-500', track: 'daytona', month: 2 },
    { name: 'las-vegas-400', track: 'las-vegas', month: 3 },
    { name: 'phoenix-500', track: 'phoenix', month: 3 },
    { name: 'atlanta-400', track: 'atlanta', month: 3 },
    { name: 'cota-400', track: 'cota', month: 3 },
    { name: 'richmond-400', track: 'richmond', month: 4 },
    { name: 'martinsville-500', track: 'martinsville', month: 4 },
    { name: 'bristol-500', track: 'bristol', month: 4 },
    { name: 'talladega-500', track: 'talladega', month: 4 },
    { name: 'dover-400', track: 'dover', month: 5 }
  ];

  for (const year of years) {
    for (const template of raceTemplates) {
      races.push({
        ...template,
        year,
        date: `${year}-${String(template.month).padStart(2, '0')}-01`
      });
    }
  }

  return races;
}

function generateRaceUrl(source: string, race: any): string {
  switch (source) {
    case 'nascar':
      return `https://www.nascar.com/results/racecenter/${race.year}/${race.name}/`;
    case 'racing_reference':
      return `https://www.racing-reference.info/race-results/${race.year}/${race.track}/`;
    case 'jayski':
      return `https://www.jayski.com/nascar-cup-series/${race.year}-results/${race.name}/`;
    default:
      return `https://www.nascar.com/results/racecenter/${race.year}/${race.name}/`;
  }
}

async function fetchRaceData(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

function extractRaceResults(html: string, race: any) {
  const $ = cheerio.load(html);
  const results: any[] = [];

  $('.results-table tbody tr, .race-results-table tbody tr, table tr').each((i, row) => {
    if (i === 0) return; // Skip header

    const $row = $(row);
    const cells = $row.find('td');

    if (cells.length >= 3) {
      const position = parseInt($(cells[0]).text().trim()) || i;
      const driverName = $(cells[1]).text().trim();
      const carNumber = $(cells[2]).text().trim().replace('#', '');

      if (driverName && carNumber && position <= 40) {
        results.push({
          position,
          driverName: cleanDriverName(driverName),
          carNumber,
          team: $(cells[3])?.text().trim() || 'Unknown',
          lapsCompleted: parseInt($(cells[4])?.text().trim()) || 0,
          status: $(cells[5])?.text().trim() || 'Running',
          year: race.year
        });
      }
    }
  });

  return results;
}

function cleanDriverName(name: string): string {
  return name
    .replace(/^\d+\.\s*/, '')
    .replace(/\s*\(.*\)/, '')
    .trim();
}

async function saveRaceResults(results: any[], race: any) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const eventId = `${race.name}_${race.year}`;

    for (const result of results) {
      const driverId = result.driverName.toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      const [firstName, ...lastNameParts] = result.driverName.split(' ');
      const lastName = lastNameParts.join(' ');

      await client.query(`
        INSERT INTO drivers (id, first_name, last_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET first_name = $2, last_name = $3
      `, [driverId, firstName, lastName]);

      await client.query(`
        INSERT INTO race_results 
        (event_id, driver_id, car_number, finish_position, laps_completed, status, year)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (event_id, driver_id) 
        DO UPDATE SET 
          finish_position = $4,
          laps_completed = $5,
          status = $6,
          year = $7
      `, [eventId, driverId, result.carNumber, result.position, result.lapsCompleted, result.status, result.year]);
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
        COUNT(DISTINCT year) as years,
        COUNT(DISTINCT driver_id) as drivers
      FROM race_results
    `);

    console.log('\n📊 DYNAMIC RACE RESULTS:');
    console.log(`Total results: ${summary.rows[0].total_results}`);
    console.log(`Events: ${summary.rows[0].events}`);
    console.log(`Years: ${summary.rows[0].years}`);
    console.log(`Drivers: ${summary.rows[0].drivers}`);

  } finally {
    client.release();
    await pool.end();
  }
}

// CLI parsing
const args = process.argv.slice(2);
const config: RaceConfig = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--years':
      config.years = args[++i].split(',').map(Number);
      break;
    case '--series':
      config.series = args[++i].split(',');
      break;
    case '--max':
      config.maxRaces = Number(args[++i]);
      break;
    case '--sources':
      config.sources = args[++i].split(',');
      break;
  }
}

scrapeDynamicRaces(config);

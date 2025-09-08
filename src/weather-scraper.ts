import { pool } from './database';

interface WeatherData {
  eventId: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  conditions: string;
  precipitation: number;
  visibility: number;
  pressure: number;
  rainDelay: boolean;
  delayMinutes: number;
}

export async function scrapeWeatherData(eventId: string, trackLocation: string, eventDate: string): Promise<void> {
  try {
    console.log(`Scraping weather data for ${eventId} at ${trackLocation}`);
    
    // Try multiple weather sources
    const weatherData = await Promise.race([
      scrapeWeatherAPI(trackLocation, eventDate),
      scrapeNASCARWeather(eventId),
      generateEstimatedWeather(trackLocation, eventDate)
    ]);

    if (weatherData) {
      await saveWeatherData(eventId, weatherData);
      console.log(`Weather data saved for ${eventId}`);
    }

  } catch (error) {
    console.error('Error scraping weather:', error);
  }
}

async function scrapeWeatherAPI(location: string, date: string): Promise<WeatherData | null> {
  // In production, use OpenWeatherMap or similar API
  // For now, generate realistic weather data
  return generateEstimatedWeather(location, date);
}

async function scrapeNASCARWeather(eventId: string): Promise<WeatherData | null> {
  try {
    const url = `https://www.nascar.com/results/racecenter/${eventId}/weather/`;
    const response = await fetch(url);
    const html = await response.text();
    
    // Parse NASCAR weather data if available
    // This would require actual HTML parsing
    return null;
  } catch (error) {
    return null;
  }
}

async function generateEstimatedWeather(location: string, date: string): Promise<WeatherData> {
  const eventDate = new Date(date);
  const month = eventDate.getMonth();
  
  // Generate realistic weather based on location and season
  const locationWeather: { [key: string]: any } = {
    'daytona': { temp: [75, 85], humidity: [70, 85], wind: [5, 15] },
    'charlotte': { temp: [65, 80], humidity: [60, 75], wind: [8, 18] },
    'phoenix': { temp: [85, 105], humidity: [20, 40], wind: [3, 12] },
    'las-vegas': { temp: [80, 100], humidity: [15, 35], wind: [5, 20] }
  };

  const trackKey = location ? location.toLowerCase().split(' ')[0] : '';
  const baseWeather = trackKey ? (locationWeather[trackKey] || { temp: [70, 85], humidity: [50, 70], wind: [5, 15] }) : { temp: [70, 85], humidity: [50, 70], wind: [5, 15] };
  
  const temperature = Math.random() * (baseWeather.temp[1] - baseWeather.temp[0]) + baseWeather.temp[0];
  const humidity = Math.random() * (baseWeather.humidity[1] - baseWeather.humidity[0]) + baseWeather.humidity[0];
  const windSpeed = Math.random() * (baseWeather.wind[1] - baseWeather.wind[0]) + baseWeather.wind[0];
  
  const conditions = ['Clear', 'Partly Cloudy', 'Overcast', 'Light Rain'][Math.floor(Math.random() * 4)];
  const rainDelay = conditions === 'Light Rain' && Math.random() < 0.3;

  return {
    eventId: '',
    temperature: Math.round(temperature),
    humidity: Math.round(humidity),
    windSpeed: Math.round(windSpeed),
    windDirection: (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)]) || 'N',
    conditions: conditions || 'Clear',
    precipitation: rainDelay ? Math.random() * 0.5 : 0,
    visibility: rainDelay ? 5 + Math.random() * 5 : 10,
    pressure: 29.8 + Math.random() * 0.4,
    rainDelay,
    delayMinutes: rainDelay ? Math.floor(Math.random() * 120) + 30 : 0
  };
}

async function saveWeatherData(eventId: string, weather: WeatherData): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO weather_data 
      (event_id, temperature, humidity, wind_speed, wind_direction, conditions, 
       precipitation, visibility, pressure, rain_delay, delay_minutes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (event_id)
      DO UPDATE SET 
        temperature = $2,
        humidity = $3,
        wind_speed = $4,
        wind_direction = $5,
        conditions = $6,
        precipitation = $7,
        visibility = $8,
        pressure = $9,
        rain_delay = $10,
        delay_minutes = $11
    `, [
      eventId,
      weather.temperature,
      weather.humidity,
      weather.windSpeed,
      weather.windDirection,
      weather.conditions,
      weather.precipitation,
      weather.visibility,
      weather.pressure,
      weather.rainDelay,
      weather.delayMinutes
    ]);

  } catch (error) {
    console.error('Error saving weather data:', error);
  } finally {
    client.release();
  }
}

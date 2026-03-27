/**
 * Parses current weather conditions from wttr JSON API payload.
 *
 * Args:
 *   apiData: Raw JSON payload from wttr `format=j1` endpoint.
 *
 * Returns:
 *   Normalized object with current weather attributes.
 *
 * Throws:
 *   Error: If `current_condition` is missing.
 */
export function parseCurrentFromApi(apiData) {
  const current = apiData?.current_condition?.[0];
  if (!current) {
    throw new Error("wttr API response missing current_condition");
  }

  return {
    observedAt: current.observation_time,
    temperatureC: current.temp_C,
    temperatureF: current.temp_F,
    feelsLikeC: current.FeelsLikeC,
    feelsLikeF: current.FeelsLikeF,
    humidity: current.humidity,
    windKmph: current.windspeedKmph,
    windMph: current.windspeedMiles,
    windDirection: current.winddir16Point,
    pressure: current.pressure,
    uvIndex: current.uvIndex,
    condition: current.weatherDesc?.[0]?.value,
    precipitationMm: current.precipMM,
    cloudCover: current.cloudcover,
  };
}

/**
 * Parses forecast entries from wttr JSON API payload.
 *
 * Args:
 *   apiData: Raw JSON payload from wttr `format=j1` endpoint.
 *   days: Number of forecast days to keep (1..3).
 *
 * Returns:
 *   List of normalized forecast-day objects.
 *
 * Throws:
 *   Error: Never thrown intentionally; returns empty list for missing forecast sections.
 */
export function parseForecastFromApi(apiData, days) {
  // Slice first, then map, so consumers receive deterministic day count.
  const weatherDays = Array.isArray(apiData?.weather) ? apiData.weather.slice(0, days) : [];

  return weatherDays.map((day) => ({
    date: day.date,
    maxTempC: day.maxtempC,
    minTempC: day.mintempC,
    avgTempC: day.avgtempC,
    maxTempF: day.maxtempF,
    minTempF: day.mintempF,
    avgTempF: day.avgtempF,
    uvIndex: day.uvIndex,
    astronomy: day.astronomy?.[0] || null,
    hourly: (day.hourly || []).map((hourlyEntry) => ({
      time: hourlyEntry.time,
      tempC: hourlyEntry.tempC,
      tempF: hourlyEntry.tempF,
      feelsLikeC: hourlyEntry.FeelsLikeC,
      feelsLikeF: hourlyEntry.FeelsLikeF,
      humidity: hourlyEntry.humidity,
      chanceOfRain: hourlyEntry.chanceofrain,
      chanceOfSnow: hourlyEntry.chanceofsnow,
      windKmph: hourlyEntry.windspeedKmph,
      windDir: hourlyEntry.winddir16Point,
      condition: hourlyEntry.weatherDesc?.[0]?.value,
    })),
  }));
}

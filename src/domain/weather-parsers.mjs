/**
 * Normalizes language key to wttr JSON suffix format.
 *
 * Args:
 *   langCode: Requested language code (e.g. ru, ru-RU, en-US).
 *
 * Returns:
 *   Normalized short language token (e.g. ru, en).
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function normalizeLangCode(langCode) {
  return String(langCode || "").toLowerCase().split(/[-_,]/)[0];
}

/**
 * Picks localized condition text from wttr payload entry.
 *
 * Args:
 *   entry: wttr condition entry (current/hourly).
 *   langCode: Requested language code.
 *
 * Returns:
 *   Localized condition if available, otherwise default weatherDesc value.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function pickConditionText(entry, langCode) {
  const normalizedLang = normalizeLangCode(langCode);
  const localizedKey = normalizedLang ? `lang_${normalizedLang}` : "";

  const localized = localizedKey ? entry?.[localizedKey]?.[0]?.value : null;
  if (typeof localized === "string" && localized.trim()) {
    return localized.trim();
  }

  const fallback = entry?.weatherDesc?.[0]?.value;
  return typeof fallback === "string" ? fallback.trim() : null;
}

/**
 * Parses current weather conditions from wttr JSON API payload.
 *
 * Args:
 *   apiData: Raw JSON payload from wttr `format=j1` endpoint.
 *   langCode: Preferred condition language code.
 *
 * Returns:
 *   Normalized object with current weather attributes.
 *
 * Throws:
 *   Error: If `current_condition` is missing.
 */
export function parseCurrentFromApi(apiData, { langCode } = {}) {
  // wttr keeps current conditions as a single-element array.
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
    condition: pickConditionText(current, langCode),
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
 *   langCode: Preferred condition language code.
 *
 * Returns:
 *   List of normalized forecast-day objects.
 *
 * Throws:
 *   Error: Never thrown intentionally; returns empty list for missing forecast sections.
 */
export function parseForecastFromApi(apiData, days, { langCode } = {}) {
  // Slice first, then map, so consumers receive deterministic day count.
  const weatherDays = Array.isArray(apiData?.weather) ? apiData.weather.slice(0, days) : [];

  return weatherDays.map((day) => ({
    // Flatten top-level daily metrics first.
    date: day.date,
    maxTempC: day.maxtempC,
    minTempC: day.mintempC,
    avgTempC: day.avgtempC,
    maxTempF: day.maxtempF,
    minTempF: day.mintempF,
    avgTempF: day.avgtempF,
    uvIndex: day.uvIndex,
    astronomy: day.astronomy?.[0] || null,
    // Convert each hourly snapshot into stable camelCase fields.
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
      condition: pickConditionText(hourlyEntry, langCode),
    })),
  }));
}

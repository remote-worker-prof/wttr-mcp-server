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

export function parseForecastFromApi(apiData, days) {
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
    hourly: (day.hourly || []).map((h) => ({
      time: h.time,
      tempC: h.tempC,
      tempF: h.tempF,
      feelsLikeC: h.FeelsLikeC,
      feelsLikeF: h.FeelsLikeF,
      humidity: h.humidity,
      chanceOfRain: h.chanceofrain,
      chanceOfSnow: h.chanceofsnow,
      windKmph: h.windspeedKmph,
      windDir: h.winddir16Point,
      condition: h.weatherDesc?.[0]?.value,
    })),
  }));
}

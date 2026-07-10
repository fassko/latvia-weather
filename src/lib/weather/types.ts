export interface HourlyForecastRaw {
  punkts: string;
  nosaukums: string;
  novads: string;
  laiks: string;
  temperatura: string;
  veja_atrums: string;
  veja_virziens: string;
  brazmas: string;
  nokrisni_1h: string;
  relativais_mitrums: string;
  laika_apstaklu_ikona: string;
  spiediens: string;
  sajutu_temperatura: string;
  sniegs: string | null;
  makoni: string;
  nokrisnu_varbutiba: string;
  uvi_indekss: string | null;
  perkons: string;
}

export interface HourlyForecast {
  time: Date;
  temperature: number;
  feelsLike: number;
  precipitation: number;
  snow: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  windDirection: number;
  pressure: number;
  cloudCover: number;
  iconCode: string;
  precipitationProbability: number;
  uvIndex: number | null;
  thunderProbability: number;
}

export interface WeatherLocation {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
}

export interface WeatherPointForecastRaw {
  punkts: string;
  svars: number;
  nosaukums: string;
  novads: string;
  lon: string;
  lat: string;
  temperatura: string;
  veja_atrums: string;
  veja_virziens: string;
  brazmas: string;
  nokrisni_1h: string;
  relativais_mitrums: string;
  laika_apstaklu_ikona: string;
  spiediens: string;
  sajutu_temperatura: string;
  sniegs: string;
  makoni: string;
  nokrisnu_varbutiba: string;
  uvi_indekss: string;
  perkons: string;
}

export interface WeatherLocationPoint extends WeatherLocation {
  temperature: number;
  iconCode: string;
}

export interface WeatherData {
  location: WeatherLocation;
  forecasts: HourlyForecast[];
  fetchedAt: Date;
  isStale?: boolean;
}

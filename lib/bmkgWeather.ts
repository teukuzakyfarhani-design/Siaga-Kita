export const bmkgWeatherLocations = [
  { id: "11.71.01.2001", label: "Kota Banda Aceh" },
  { id: "11.01.01.2001", label: "Aceh Selatan" },
  { id: "11.05.01.2001", label: "Aceh Barat" },
  { id: "11.06.01.2001", label: "Aceh Besar" },
  { id: "11.14.01.2001", label: "Aceh Jaya" },
  { id: "11.10.01.2001", label: "Aceh Singkil" },
  { id: "11.16.01.2001", label: "Aceh Tamiang" },
  { id: "11.03.01.2001", label: "Aceh Timur" },
  { id: "11.08.01.2001", label: "Aceh Utara" },
  { id: "11.17.01.2001", label: "Bener Meriah" },
  { id: "11.11.01.2001", label: "Bireuen" },
  { id: "11.13.01.2001", label: "Gayo Lues" },
  { id: "11.18.01.2001", label: "Pidie Jaya" },
  { id: "11.75.01.2001", label: "Kota Subulussalam" },
  { id: "11.12.02.2001", label: "Aceh Barat Daya" },
] as const;

export type BmkgWeatherLocationId = (typeof bmkgWeatherLocations)[number]["id"];

export type BmkgWeatherPoint = {
  localDateTime: string;
  temperature: number;
  humidity: number;
  rainfall: number;
  weather: string;
  windSpeed: number;
};

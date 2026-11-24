export const campuses = ["Kemanggisan", "Alam Sutera", "Senayan", "Bekasi"] as const;
type Campus = typeof campuses[number];

/** Data contoh untuk prototipe. ID tetap dipakai saat nama lokasi berubah. */
export const demoLocations: { id: string; name: string; campus: Campus }[] = [
  { id: "anggrek-perpustakaan", name: "Lobi Perpustakaan Anggrek", campus: "Kemanggisan" },
  { id: "anggrek-kantin", name: "Kantin Anggrek", campus: "Kemanggisan" },
  { id: "alsut-lobi", name: "Lobi utama BINUS Alam Sutera", campus: "Alam Sutera" },
  { id: "alsut-kantin", name: "Kantin BINUS Alam Sutera", campus: "Alam Sutera" },
  { id: "senayan-lobi", name: "Lobi utama BINUS Senayan", campus: "Senayan" },
  { id: "senayan-kantin", name: "Kantin BINUS Senayan", campus: "Senayan" },
  { id: "bekasi-lobi", name: "Lobi utama BINUS Bekasi", campus: "Bekasi" },
  { id: "bekasi-kantin", name: "Kantin BINUS Bekasi", campus: "Bekasi" },
];
export const campusLocations = (campus: Campus) => demoLocations.filter((place) => place.campus === campus);
export const locationFor = (campus: Campus, id: string) => demoLocations.find((place) => place.campus === campus && place.id === id);
const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export function locationFromName(name: string, campus?: Campus) {
  const matches = demoLocations.filter((place) => (!campus || place.campus === campus) && normalizeName(place.name) === normalizeName(name));
  return matches.length === 1 ? matches[0] : undefined;
}
export function migratePoints(campus: Campus, values: string[]) {
  return Array.from(new Set(values.map((value) => locationFromName(value, campus)?.id ?? value)));
}
export function validPoints(campus: Campus, ids: string[]) {
  return ids.length > 0 && ids.every((id) => !!locationFor(campus, id));
}

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { UserSchedule } from "@shared/schema";

/**
 * Returns the user's saved timezone, falling back to the browser's detected timezone.
 * Also provides a utility to get today's date string (YYYY-MM-DD) in that timezone.
 */
export function useUserTimezone() {
  const { data: schedule } = useQuery<UserSchedule | null>({
    queryKey: ["/api/schedule"],
    queryFn: () => apiRequest("GET", "/api/schedule").then(r => r.json()),
    staleTime: 60_000,
  });

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezone = schedule?.timezone || browserTz;

  function getTodayString(): string {
    return getTodayInTimezone(timezone);
  }

  return { timezone, getTodayString };
}

/**
 * Get the current date as YYYY-MM-DD in the given IANA timezone.
 * Example: "America/New_York" returns "2026-03-17" even if UTC is still "2026-03-18".
 */
export function getTodayInTimezone(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Get the browser's local timezone string.
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * A curated list of common IANA timezones for the selector.
 * Groups: Americas, Europe, Asia/Pacific, Africa, UTC
 */
export const TIMEZONE_OPTIONS: { value: string; label: string; group: string }[] = [
  // UTC
  { value: "UTC", label: "UTC — Coordinated Universal Time", group: "UTC" },

  // Americas
  { value: "America/New_York", label: "Eastern Time (New York)", group: "Americas" },
  { value: "America/Chicago", label: "Central Time (Chicago)", group: "Americas" },
  { value: "America/Denver", label: "Mountain Time (Denver)", group: "Americas" },
  { value: "America/Phoenix", label: "Mountain Time — no DST (Phoenix)", group: "Americas" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)", group: "Americas" },
  { value: "America/Anchorage", label: "Alaska Time (Anchorage)", group: "Americas" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (Honolulu)", group: "Americas" },
  { value: "America/Toronto", label: "Eastern Time (Toronto)", group: "Americas" },
  { value: "America/Vancouver", label: "Pacific Time (Vancouver)", group: "Americas" },
  { value: "America/Mexico_City", label: "Central Time (Mexico City)", group: "Americas" },
  { value: "America/Sao_Paulo", label: "Brasília Time (São Paulo)", group: "Americas" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina Time (Buenos Aires)", group: "Americas" },
  { value: "America/Bogota", label: "Colombia Time (Bogotá)", group: "Americas" },
  { value: "America/Lima", label: "Peru Time (Lima)", group: "Americas" },
  { value: "America/Santiago", label: "Chile Time (Santiago)", group: "Americas" },
  { value: "America/Caracas", label: "Venezuela Time (Caracas)", group: "Americas" },

  // Europe
  { value: "Europe/London", label: "GMT/BST (London)", group: "Europe" },
  { value: "Europe/Dublin", label: "GMT/IST (Dublin)", group: "Europe" },
  { value: "Europe/Lisbon", label: "WET/WEST (Lisbon)", group: "Europe" },
  { value: "Europe/Paris", label: "CET/CEST (Paris)", group: "Europe" },
  { value: "Europe/Berlin", label: "CET/CEST (Berlin)", group: "Europe" },
  { value: "Europe/Rome", label: "CET/CEST (Rome)", group: "Europe" },
  { value: "Europe/Madrid", label: "CET/CEST (Madrid)", group: "Europe" },
  { value: "Europe/Amsterdam", label: "CET/CEST (Amsterdam)", group: "Europe" },
  { value: "Europe/Brussels", label: "CET/CEST (Brussels)", group: "Europe" },
  { value: "Europe/Zurich", label: "CET/CEST (Zurich)", group: "Europe" },
  { value: "Europe/Stockholm", label: "CET/CEST (Stockholm)", group: "Europe" },
  { value: "Europe/Oslo", label: "CET/CEST (Oslo)", group: "Europe" },
  { value: "Europe/Copenhagen", label: "CET/CEST (Copenhagen)", group: "Europe" },
  { value: "Europe/Helsinki", label: "EET/EEST (Helsinki)", group: "Europe" },
  { value: "Europe/Athens", label: "EET/EEST (Athens)", group: "Europe" },
  { value: "Europe/Bucharest", label: "EET/EEST (Bucharest)", group: "Europe" },
  { value: "Europe/Warsaw", label: "CET/CEST (Warsaw)", group: "Europe" },
  { value: "Europe/Prague", label: "CET/CEST (Prague)", group: "Europe" },
  { value: "Europe/Vienna", label: "CET/CEST (Vienna)", group: "Europe" },
  { value: "Europe/Budapest", label: "CET/CEST (Budapest)", group: "Europe" },
  { value: "Europe/Moscow", label: "Moscow Time (Moscow)", group: "Europe" },
  { value: "Europe/Istanbul", label: "Turkey Time (Istanbul)", group: "Europe" },
  { value: "Europe/Kiev", label: "EET/EEST (Kyiv)", group: "Europe" },

  // Asia & Pacific
  { value: "Asia/Dubai", label: "Gulf Standard Time (Dubai)", group: "Asia/Pacific" },
  { value: "Asia/Riyadh", label: "Arabia Standard Time (Riyadh)", group: "Asia/Pacific" },
  { value: "Asia/Tehran", label: "Iran Time (Tehran)", group: "Asia/Pacific" },
  { value: "Asia/Karachi", label: "Pakistan Time (Karachi)", group: "Asia/Pacific" },
  { value: "Asia/Kolkata", label: "India Standard Time (Kolkata)", group: "Asia/Pacific" },
  { value: "Asia/Colombo", label: "Sri Lanka Time (Colombo)", group: "Asia/Pacific" },
  { value: "Asia/Dhaka", label: "Bangladesh Time (Dhaka)", group: "Asia/Pacific" },
  { value: "Asia/Yangon", label: "Myanmar Time (Yangon)", group: "Asia/Pacific" },
  { value: "Asia/Bangkok", label: "Indochina Time (Bangkok)", group: "Asia/Pacific" },
  { value: "Asia/Jakarta", label: "Western Indonesia Time (Jakarta)", group: "Asia/Pacific" },
  { value: "Asia/Singapore", label: "Singapore Time (Singapore)", group: "Asia/Pacific" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia Time (Kuala Lumpur)", group: "Asia/Pacific" },
  { value: "Asia/Manila", label: "Philippine Time (Manila)", group: "Asia/Pacific" },
  { value: "Asia/Shanghai", label: "China Standard Time (Shanghai)", group: "Asia/Pacific" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time (Hong Kong)", group: "Asia/Pacific" },
  { value: "Asia/Taipei", label: "Taiwan Time (Taipei)", group: "Asia/Pacific" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (Tokyo)", group: "Asia/Pacific" },
  { value: "Asia/Seoul", label: "Korea Standard Time (Seoul)", group: "Asia/Pacific" },
  { value: "Australia/Perth", label: "AWST (Perth)", group: "Asia/Pacific" },
  { value: "Australia/Darwin", label: "ACST (Darwin)", group: "Asia/Pacific" },
  { value: "Australia/Adelaide", label: "ACST/ACDT (Adelaide)", group: "Asia/Pacific" },
  { value: "Australia/Sydney", label: "AEST/AEDT (Sydney)", group: "Asia/Pacific" },
  { value: "Australia/Melbourne", label: "AEST/AEDT (Melbourne)", group: "Asia/Pacific" },
  { value: "Australia/Brisbane", label: "AEST no DST (Brisbane)", group: "Asia/Pacific" },
  { value: "Pacific/Auckland", label: "NZST/NZDT (Auckland)", group: "Asia/Pacific" },
  { value: "Pacific/Fiji", label: "Fiji Time (Suva)", group: "Asia/Pacific" },

  // Africa
  { value: "Africa/Cairo", label: "Eastern European Time (Cairo)", group: "Africa" },
  { value: "Africa/Johannesburg", label: "South Africa Time (Johannesburg)", group: "Africa" },
  { value: "Africa/Lagos", label: "West Africa Time (Lagos)", group: "Africa" },
  { value: "Africa/Nairobi", label: "East Africa Time (Nairobi)", group: "Africa" },
  { value: "Africa/Casablanca", label: "Western European Time (Casablanca)", group: "Africa" },
];

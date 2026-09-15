import { AgeCohort, AgeDemographics, GenerationDemographic } from './types';

/**
 * Robustly parses a Date of Birth string into a valid JavaScript Date object.
 * Supports:
 * - "DD / MM / YYYY", "DD/MM/YYYY", "DD-MM-YYYY", "DD.MM.YYYY"
 * - "YYYY-MM-DD", "YYYY/MM/DD"
 * - Standard ISO-8601 or RFC-2822 date strings
 */
export function parseDobToDate(dobStr: string | null | undefined): Date | null {
  if (!dobStr || typeof dobStr !== 'string') return null;
  const trimmed = dobStr.trim();
  if (!trimmed) return null;

  // Pattern 1: DD / MM / YYYY or DD-MM-YYYY (most common in TapKnock app)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\s\/\-\.]+(\d{1,2})[\s\/\-\.]+(\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed month
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
      return d;
    }
  }

  // Pattern 2: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\s\/\-\.]+(\d{1,2})[\s\/\-\.]+(\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
      return d;
    }
  }

  // Pattern 3: Fallback native Date parse
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  return null;
}

/**
 * Calculates current exact integer age in years from DOB string.
 * Returns null if DOB is missing, invalid, or out of reasonable human range (0-125).
 */
export function calculateAge(dobStr: string | null | undefined): number | null {
  const birthDate = parseDobToDate(dobStr);
  if (!birthDate) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age < 0 || age > 125) {
    return null;
  }

  return age;
}

/**
 * Maps an age to a standard demographic cohort bucket.
 */
export function getAgeCohort(age: number | null): string {
  if (age === null) return 'Unspecified';
  if (age < 18) return '< 18';
  if (age <= 24) return '18–24';
  if (age <= 34) return '25–34';
  if (age <= 44) return '35–44';
  if (age <= 54) return '45–54';
  if (age <= 64) return '55–64';
  return '65+';
}

/**
 * Maps a birth date to a sociological generation.
 */
export function getGeneration(birthDate: Date | null): string {
  if (!birthDate) return 'Unspecified';
  const year = birthDate.getFullYear();
  if (year >= 2013) return 'Gen Alpha (2013+)';
  if (year >= 1997) return 'Gen Z (1997–2012)';
  if (year >= 1981) return 'Millennials (1981–1996)';
  if (year >= 1965) return 'Gen X (1965–1980)';
  if (year >= 1946) return 'Baby Boomers (1946–1964)';
  return 'Silent Gen (<= 1945)';
}

export const COHORT_DEFINITIONS = [
  { cohort: '< 18', label: 'Under 18', color: '#06B6D4' },
  { cohort: '18–24', label: 'Young Adults (18–24)', color: '#3B82F6' },
  { cohort: '25–34', label: 'Early Career / Young Families (25–34)', color: '#6366F1' },
  { cohort: '35–44', label: 'Prime Homeowners (35–44)', color: '#8B5CF6' },
  { cohort: '45–54', label: 'Mature Homeowners (45–54)', color: '#EC4899' },
  { cohort: '55–64', label: 'Pre-Retirement (55–64)', color: '#F59E0B' },
  { cohort: '65+', label: 'Seniors & Golden Age (65+)', color: '#10B981' },
  { cohort: 'Unspecified', label: 'DOB Not Provided', color: '#64748B' },
];

export const GENERATION_COLORS: Record<string, string> = {
  'Gen Alpha (2013+)': '#06B6D4',
  'Gen Z (1997–2012)': '#3B82F6',
  'Millennials (1981–1996)': '#6366F1',
  'Gen X (1965–1980)': '#EC4899',
  'Baby Boomers (1946–1964)': '#10B981',
  'Silent Gen (<= 1945)': '#F59E0B',
  'Unspecified': '#64748B',
};

export interface AccountDemographicInput {
  id: string;
  dob?: string | null;
  door_count?: number | string | null;
  ring_count?: number | string | null;
}

/**
 * Computes comprehensive age demographics, cohorts, generation breakdown,
 * and engagement metrics (doors owned & rings logged per age cohort).
 */
export function computeDemographics(accounts: AccountDemographicInput[]): AgeDemographics {
  const totalAccounts = accounts.length;
  let totalWithDob = 0;
  const validAges: number[] = [];

  // Cohort buckets accumulator
  const cohortMap: Record<
    string,
    { usersCount: number; doorsCount: number; ringsCount: number; color: string }
  > = {};

  for (const def of COHORT_DEFINITIONS) {
    cohortMap[def.cohort] = {
      usersCount: 0,
      doorsCount: 0,
      ringsCount: 0,
      color: def.color,
    };
  }

  // Generation buckets accumulator
  const genMap: Record<string, { count: number; color: string }> = {};

  for (const acc of accounts) {
    const doors = typeof acc.door_count === 'number' ? acc.door_count : parseInt(String(acc.door_count || '0'), 10);
    const rings = typeof acc.ring_count === 'number' ? acc.ring_count : parseInt(String(acc.ring_count || '0'), 10);

    const birthDate = parseDobToDate(acc.dob);
    const age = calculateAge(acc.dob);
    const cohort = getAgeCohort(age);
    const generation = getGeneration(birthDate);

    if (age !== null) {
      totalWithDob++;
      validAges.push(age);
    }

    if (!cohortMap[cohort]) {
      cohortMap[cohort] = { usersCount: 0, doorsCount: 0, ringsCount: 0, color: '#64748B' };
    }
    cohortMap[cohort].usersCount += 1;
    cohortMap[cohort].doorsCount += isNaN(doors) ? 0 : doors;
    cohortMap[cohort].ringsCount += isNaN(rings) ? 0 : rings;

    if (!genMap[generation]) {
      genMap[generation] = { count: 0, color: GENERATION_COLORS[generation] || '#60A5FA' };
    }
    genMap[generation].count += 1;
  }

  const totalWithoutDob = totalAccounts - totalWithDob;
  const dobCompletionRate = totalAccounts > 0 ? Math.round((totalWithDob / totalAccounts) * 1000) / 10 : 0;

  // Average & Median Age calculation
  let averageAge: number | null = null;
  let medianAge: number | null = null;
  let youngestAge: number | null = null;
  let oldestAge: number | null = null;

  if (validAges.length > 0) {
    validAges.sort((a, b) => a - b);
    youngestAge = validAges[0];
    oldestAge = validAges[validAges.length - 1];

    const sum = validAges.reduce((a, b) => a + b, 0);
    averageAge = Math.round((sum / validAges.length) * 10) / 10;

    const mid = Math.floor(validAges.length / 2);
    if (validAges.length % 2 === 0) {
      medianAge = Math.round(((validAges[mid - 1] + validAges[mid]) / 2) * 10) / 10;
    } else {
      medianAge = validAges[mid];
    }
  }

  // Format cohorts list
  const cohorts: AgeCohort[] = COHORT_DEFINITIONS.map((def) => {
    const data = cohortMap[def.cohort] || { usersCount: 0, doorsCount: 0, ringsCount: 0, color: def.color };
    const percentage = totalAccounts > 0 ? Math.round((data.usersCount / totalAccounts) * 1000) / 10 : 0;
    const avgDoorsPerUser = data.usersCount > 0 ? Math.round((data.doorsCount / data.usersCount) * 10) / 10 : 0;
    const avgRingsPerUser = data.usersCount > 0 ? Math.round((data.ringsCount / data.usersCount) * 10) / 10 : 0;

    return {
      cohort: def.cohort,
      usersCount: data.usersCount,
      doorsCount: data.doorsCount,
      ringsCount: data.ringsCount,
      avgDoorsPerUser,
      avgRingsPerUser,
      percentage,
      color: def.color,
    };
  });

  // Dominant specified age group
  const specifiedCohorts = cohorts.filter((c) => c.cohort !== 'Unspecified');
  let dominantAgeGroup: string | null = null;
  if (specifiedCohorts.length > 0) {
    const top = [...specifiedCohorts].sort((a, b) => b.usersCount - a.usersCount)[0];
    if (top && top.usersCount > 0) {
      dominantAgeGroup = top.cohort;
    }
  }

  // Format generations list
  const generations: GenerationDemographic[] = Object.entries(genMap)
    .filter(([_, data]) => data.count > 0)
    .map(([name, data]) => ({
      name,
      count: data.count,
      percentage: totalAccounts > 0 ? Math.round((data.count / totalAccounts) * 1000) / 10 : 0,
      color: data.color,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalAccounts,
    totalWithDob,
    totalWithoutDob,
    dobCompletionRate,
    averageAge,
    medianAge,
    youngestAge,
    oldestAge,
    dominantAgeGroup,
    cohorts,
    generations,
  };
}

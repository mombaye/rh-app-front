// Utilitaire pour gérer les jours fériés

const LS_HOLIDAYS_KEY = "camu_public_holidays";

/**
 * Récupère la liste des jours fériés depuis localStorage
 */
export function getHolidays(): string[] {
  try {
    const stored = localStorage.getItem(LS_HOLIDAYS_KEY);
    if (stored) return JSON.parse(stored) as string[];
  } catch (e) {
    console.error("Erreur lors de la lecture des jours fériés:", e);
  }
  return [];
}

/**
 * Vérifie si une date est un jour férié
 */
export function isHoliday(date: string): boolean {
  const holidays = getHolidays();
  return holidays.includes(date);
}

/**
 * Vérifie si une date fait partie d'une plage de jours fériés
 */
export function hasHolidayInRange(startDate: string, endDate: string): boolean {
  const holidays = getHolidays();
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (const holiday of holidays) {
    const holidayDate = new Date(holiday);
    if (holidayDate >= start && holidayDate <= end) {
      return true;
    }
  }
  return false;
}

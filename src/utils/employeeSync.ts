// src/utils/employeeSync.ts
//
// Petit bus d'événements permettant de prévenir le reste de l'application
// qu'une information employé (service, hiérarchie, manager, etc.) vient
// d'être modifiée et synchronisée depuis /leaves/hierarchie.
//
// Toutes les pages qui affichent des informations sur les employés peuvent
// s'abonner via `onEmployeesSynced` pour rafraîchir automatiquement leurs
// données — sans rechargement complet de la page, et même entre onglets
// (grâce à l'événement `storage`).

const STORAGE_KEY = "employees_synced_at";
const EVENT_NAME  = "employees-synced";

/** À appeler après une mise à jour employé / synchronisation hiérarchie réussie. */
export function notifyEmployeesSynced() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore (mode privé, quota, etc.)
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

/**
 * S'abonne aux notifications de synchronisation employé.
 * Retourne une fonction de désabonnement (à utiliser dans le cleanup d'un useEffect).
 */
export function onEmployeesSynced(callback: () => void): () => void {
  const handler = () => callback();
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

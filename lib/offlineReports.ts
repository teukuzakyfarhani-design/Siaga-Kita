export type OfflineReport = {
  id: string;
  userId: string;
  incidentType: string;
  district: string;
  locality: string;
  description: string;
  latitude: number;
  longitude: number;
  queuedAt: string;
};

const databaseName = "siagakita-offline";
const storeName = "reports";

function openQueue(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Antrean offline gagal dibuka."));
  });
}

export async function saveOfflineReport(report: OfflineReport): Promise<void> {
  const database = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(report);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Laporan offline gagal disimpan."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Penyimpanan laporan offline dibatalkan."));
  });
  database.close();
}

export async function getOfflineReports(userId: string): Promise<OfflineReport[]> {
  const database = await openQueue();
  const reports = await new Promise<OfflineReport[]>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as OfflineReport[]).filter((report) => report.userId === userId));
    request.onerror = () => reject(request.error ?? new Error("Antrean offline gagal dibaca."));
  });
  database.close();
  return reports;
}

export async function removeOfflineReport(id: string): Promise<void> {
  const database = await openQueue();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Laporan offline gagal dihapus dari antrean."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Penghapusan antrean offline dibatalkan."));
  });
  database.close();
}

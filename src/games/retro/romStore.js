// Cartuchos guardados en el navegador (IndexedDB). Las ROMs nunca salen del
// dispositivo: ella las carga una vez y quedan aquí.
//   { id, title, system, fileName, blob, addedAt }

const DB = 'galaxia-retro';
const STORE = 'cartridges';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(req?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export const listCartridges = () => run('readonly', (s) => s.getAll());
export const saveCartridge = (cart) => run('readwrite', (s) => s.put(cart));
export const deleteCartridge = (id) => run('readwrite', (s) => s.delete(id));

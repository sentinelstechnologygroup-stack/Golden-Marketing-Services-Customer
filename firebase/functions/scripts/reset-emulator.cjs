const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ projectId: 'demo-gms-local' });
async function deleteCollection(ref, batchSize = 200) {
  const snapshot = await ref.limit(batchSize).get();
  if (snapshot.empty) return;
  await Promise.all(snapshot.docs.map(async (item) => {
    const children = await item.ref.listCollections();
    await Promise.all(children.map((child) => deleteCollection(child, batchSize)));
    await item.ref.delete();
  }));
  return deleteCollection(ref, batchSize);
}

getFirestore().listCollections().then(async (collections) => {
  await Promise.all(collections.map((collection) => deleteCollection(collection)));
  console.log('Reset emulator recursively; production was not contacted.');
}).catch((error) => { console.error(error); process.exitCode = 1; });

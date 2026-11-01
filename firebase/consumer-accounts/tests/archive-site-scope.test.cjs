const {test}=require('node:test'),assert=require('node:assert/strict');
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');
const {createRequire}=require('node:module'),req=createRequire(process.cwd()+'/Customer-Portal/firebase/functions/package.json');
req('firebase-admin/app').initializeApp({projectId:'demo-gms-local'});
const db=req('firebase-admin/firestore').getFirestore(),a=require('../consumer-account.cjs');
test('owner can archive and restore without deleting the original; other-owner archive fails',async()=>{
 const identity={uid:'archive-owner',email:'archive@example.invalid',accountId:'archive-owner'},id='a'.repeat(64),other='b'.repeat(64),ref=a.accountRef(db,identity.accountId),source=a.root(db).collection('websiteInquiryEmails');
 await ref.set({uid:identity.uid,email:identity.email,profile:{name:'Archive Owner',phone:''},permissions:{email:false,sms:false,callbacks:false},searches:[],homes:[],revision:1});
 await source.doc(id).set({createdAt:req('firebase-admin/firestore').Timestamp.now(),inquiry:{email:identity.email,site:'north',property:{boardId:'147',mlsNumber:'123',address:'Example'}}});
 await source.doc(other).set({inquiry:{email:'other@example.invalid',property:{boardId:'147',mlsNumber:'456'}}});
 let result=await a.mutate(db,identity,{action:'archive_inquiry',revision:1,inquiryId:id,archived:true},'north');assert.equal(result.activity[0].archived,true);assert.equal(result.activity[0].url,'/property/147/123');assert.equal((await source.doc(id).get()).exists,true);
 await assert.rejects(a.mutate(db,identity,{action:'archive_inquiry',revision:2,inquiryId:other,archived:true},'north'),/unauthorized/);
 result=await a.mutate(db,identity,{action:'archive_inquiry',revision:2,inquiryId:id,archived:false},'north');assert.equal(result.activity[0].archived,false);assert.deepEqual((await ref.get()).data().archivedInquiryIds,[]);
});
test('saved data and inquiry links stay within the selected website; cross-site mutations fail',async()=>{
 const identity={uid:'site-owner',email:'sites@example.invalid',accountId:'site-owner'},ref=a.accountRef(db,identity.accountId),north='s_'+'1'.repeat(32),gcr='s_'+'2'.repeat(32);
 await ref.set({uid:identity.uid,email:identity.email,profile:{name:'Site Owner',phone:''},permissions:{email:false,sms:false,callbacks:false},searches:[{id:north,site:'north',name:'North',filters:{location:'Conroe'},frequency:'off'},{id:gcr,site:'brokerage',name:'GCR',filters:{location:'Willis'},frequency:'off'}],homes:['147:123'],revision:1});
 let d=(await ref.get()).data();assert.deepEqual((await a.effective(db,d,'north')).homes,['147:123']);assert.deepEqual((await a.effective(db,d,'brokerage')).homes,[]);assert.deepEqual((await a.effective(db,d,'brokerage')).searches.map(x=>x.id),[gcr]);
 await assert.rejects(a.mutate(db,identity,{action:'delete_search',revision:1,searchId:north},'brokerage'),/search_not_found/);
 await a.mutate(db,identity,{action:'homes',revision:1,homes:['147:456']},'brokerage');d=(await ref.get()).data();assert.deepEqual((await a.effective(db,d,'north')).homes,['147:123']);assert.deepEqual((await a.effective(db,d,'brokerage')).homes,['147:456']);
 await a.mutate(db,identity,{action:'recently_viewed',revision:2,listingId:'147:789'},'brokerage');d=(await ref.get()).data();assert.deepEqual((await a.effective(db,d,'north')).recentlyViewed,[]);assert.deepEqual((await a.effective(db,d,'brokerage')).recentlyViewed,['147:789']);
 const source=a.root(db).collection('websiteInquiryEmails'),id='d'.repeat(64);await source.doc(id).set({createdAt:req('firebase-admin/firestore').Timestamp.now(),inquiry:{email:identity.email,site:'north',property:{boardId:'147',mlsNumber:'987'}}});assert.equal((await a.effective(db,d,'brokerage')).activity.length,0);await assert.rejects(a.mutate(db,identity,{action:'archive_inquiry',revision:3,inquiryId:id,archived:true},'brokerage'),/unauthorized/);
});


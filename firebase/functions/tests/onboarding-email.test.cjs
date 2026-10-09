const test=require('node:test'), assert=require('node:assert/strict');
const {FROM,PORTALS,buildSetupEmail,brandedActionLink,sendSetupEmail}=require('../onboarding-email.cjs');
const source='https://gms-prod-1089114348316.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=fixture-only&apiKey=public-fixture';
test('both setup variants stay on branded portal domains and use fragments',()=>{
  for(const kind of ['staff','client']) {
    const link=brandedActionLink(source,kind), result=buildSetupEmail({kind,name:'<script>fixture</script>',setupLink:link});
    assert.equal(link,PORTALS[kind]+'/set-password#code=fixture-only');
    assert.equal(result.html.includes('firebaseapp.com'),false);
    assert.equal(result.html.includes('<script>fixture'),false);
    assert.ok(result.html.includes('&lt;script&gt;'));
    assert.ok(result.html.includes('/getting-started.html'));
    assert.ok(result.text.includes('/login'));
  }
  assert.equal(FROM,'Golden Marketing Services <notifications@goldenmarketingservices.com>');
  assert.throws(()=>brandedActionLink(source.replace('firebaseapp.com','attacker.invalid'),'staff'));
  assert.throws(()=>brandedActionLink(source.replace('resetPassword','verifyEmail'),'client'));
  assert.throws(()=>buildSetupEmail({kind:'staff',setupLink:'https://attacker.invalid',name:'fixture'}));
});
test('unconfigured email provider never generates a credential link or falls back to Firebase email',async()=>{
  const result=await sendSetupEmail({apiKey:'placeholder',auth:{generatePasswordResetLink:()=>assert.fail('must not generate')},kind:'staff'},()=>assert.fail('must not send'));
  assert.equal(result.delivery,'blocked');
});
test('provider request uses GMS sender, correct recipient, idempotency key, and no links in returned metadata',async()=>{
  let sent;
  const result=await sendSetupEmail({apiKey:'re_fixture',auth:{generatePasswordResetLink:async()=>source},email:'fixture@example.invalid',name:'Fixture',kind:'staff',requestId:'fixture-request'},async(url,options)=>{sent=options;assert.equal(url,'https://api.resend.com/emails');return{ok:true,json:async()=>({id:'fixture-message'})};});
  assert.equal(JSON.parse(sent.body).from,FROM);assert.deepEqual(JSON.parse(sent.body).to,['fixture@example.invalid']);
  assert.equal(sent.headers['Idempotency-Key'],'fixture-request');assert.equal(result.delivery,'accepted');
  assert.equal(JSON.stringify(result).includes('fixture-only'),false);
});
test('provider rejection is reported as failed, never sent or delivered',async()=>{
  const result=await sendSetupEmail({apiKey:'re_fixture',auth:{generatePasswordResetLink:async()=>source},email:'fixture@example.invalid',kind:'client',requestId:'fixture'},async()=>({ok:false,json:async()=>({message:'fixture rejection'})}));
  assert.equal(result.delivery,'failed');
});

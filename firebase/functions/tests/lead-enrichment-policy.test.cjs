const test=require('node:test');const assert=require('node:assert/strict');const {financingProfile:p}=require('../lead-enrichment-policy.cjs');
test('optional financing branching does not infer referrals from hidden/stale answers',()=>{
 assert.deepEqual(p({loanPrequalified:'yes',prequalifiedAmount:' $400,000 ',workingWithLender:'no',wantsLenderReferral:'yes'}),{loanPrequalified:'yes',prequalifiedAmount:'$400,000',workingWithLender:'not_applicable',wantsLenderReferral:'not_applicable',lenderReferralRequested:false,nonDisqualifying:true});
 assert.equal(p({loanPrequalified:'no',workingWithLender:'yes',wantsLenderReferral:'yes'}).lenderReferralRequested,false);
 assert.equal(p({loanPrequalified:'no',workingWithLender:'no',wantsLenderReferral:'yes'}).lenderReferralRequested,true);
 for(const answers of [{},{loanPrequalified:'no'},{loanPrequalified:'no',workingWithLender:'no',wantsLenderReferral:'no'}]){assert.equal(p(answers).nonDisqualifying,true);assert.equal(p(answers).lenderReferralRequested,false);}
});

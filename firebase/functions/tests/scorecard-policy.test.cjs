const test=require('node:test');const assert=require('node:assert/strict');
const {rubricItems,verifiedScorecard,transcriptionSegments}=require('../telephony/scorecard-policy.cjs');
test('scorecards require every approved criterion and reject invented evidence',()=>{
 const rubric=rubricItems({questions:[{id:'one',label:'Ask the approved question'}]});
 assert.throws(()=>verifiedScorecard({items:[]},rubric,'actual transcript'));
 const result=verifiedScorecard({items:[{id:'one',outcome:'met',quote:'invented quotation'}]},rubric,'actual transcript');
 assert.equal(result.score,null);assert.equal(result.items[0].outcome,'unclear');assert.equal(result.coverage,0);
});
test('AI scorecards retain human review and compute scores from supported evidence',()=>{
 const criteria=rubricItems({fields:[{id:'one',label:'Ask timing'},{id:'two',label:'Ask permission'}]});
 const result=verifiedScorecard({items:[{id:'one',outcome:'met',quote:'next month'},{id:'two',outcome:'not_met',quote:'did not ask'}]},criteria,'next month; did not ask');
 assert.equal(result.score,50);assert.equal(result.status,'needs_human_review');assert.equal(result.aiGenerated,true);
});
test('transcripts retain channel and timestamps in chronological order',()=>{
 const result=transcriptionSegments([{channelTag:2,alternatives:[{transcript:'second',words:[{startTime:'2s',endTime:'3s'}]}]},{channelTag:1,alternatives:[{transcript:'first',words:[{startTime:'0s',endTime:'1s'}]}]}]);
 assert.equal(result.text,'first\nsecond');assert.equal(result.segments[0].channel,1);assert.equal(result.segments[1].startSeconds,2);
});
test('Golden Cross scorecards respect saved qualification weights',()=>{
 const criteria=rubricItems({questions:[{id:'identity',label:'Identity',weight:10},{id:'need',label:'Need',weight:30},{id:'timing',label:'Timing',weight:25},{id:'next',label:'Next step',weight:35}]});
 const result=verifiedScorecard({items:criteria.map(item=>({id:item.id,outcome:item.id==='identity'?'not_met':'met',quote:'confirmed'}))},criteria,'confirmed');
 assert.equal(result.score,90);
 assert.throws(()=>rubricItems({questions:[{label:'bad',weight:0}]}));
});

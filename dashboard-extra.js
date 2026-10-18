const COURSE_IDS=['junior1','junior2','junior3','high1','high2','basic'];
const count=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;
function questionId(value){const id=Number(value);return Number.isInteger(id)&&id>=1&&id<=20?String(id):null;}
function legacyIds(data){
 return (Array.isArray(data.coinRewardClaims)?data.coinRewardClaims:[]).flatMap(value=>{
  const match=typeof value==='string'&&value.match(/^eiken-pre2-interview-a:theme-(\d+)$/);
  const id=match&&questionId(match[1]);return id?[id]:[];
 });
}
function interviewIds(data){
 return [...new Set([...(Array.isArray(data.pre2InterviewA?.attemptedIds)?data.pre2InterviewA.attemptedIds:[]).map(questionId).filter(Boolean),...legacyIds(data)])].sort((a,b)=>Number(a)-Number(b));
}
export function interviewAttemptPatch(data,id,today){
 const value=questionId(id);if(!value)throw Error('問題番号が不正です。');
 return {attemptedIds:[...new Set([...interviewIds(data),value])].sort((a,b)=>Number(a)-Number(b)),lastPlayedDate:today};
}
function dateKey(ms){
 const d=new Date(Number(ms));if(!Number.isFinite(d.getTime())||Number(ms)<=0)return '';
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function extraDashboard(data={},today){
 const bests=COURSE_IDS.map(id=>data.wordBreakerBests?.[id]||{});
 const playedCourses=bests.filter(value=>count(value.score)>0||count(value.combo)>0).length;
 const wordToday=data.wordBreakerLastPlayedDate===today||Object.values(data.wordBreakerRuns||{}).some(run=>COURSE_IDS.includes(run?.course)&&dateKey(run.updatedAt||run.opened)===today);
 return {
  word:{score:Math.max(0,...bests.map(v=>count(v.score))),combo:Math.max(0,...bests.map(v=>count(v.combo))),courses:playedCourses,today:wordToday},
  interview:{attempted:interviewIds(data).length,today:data.pre2InterviewA?.lastPlayedDate===today||(data.coinRewardDate===today&&legacyIds(data).length>0)}
 };
}

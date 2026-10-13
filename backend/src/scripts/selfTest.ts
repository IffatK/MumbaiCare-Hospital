import assert from 'assert';
import { transformRows } from '../services/etl';
import { kmeansCore } from '../services/mining/kmeans';
import { runDecisionTree } from '../services/mining/decisionTree';
import { aprioriCore } from '../services/mining/apriori';
import { runNaiveBayes } from '../services/mining/naiveBayes';
import { runDBSCAN } from '../services/mining/dbscan';
import { rng } from '../services/mining/random';
let passed=0;const ok=(name:string,fn:()=>void)=>{fn();passed++;console.log(' ✓',name);};
const base={record_id:'MC-1',hospital_id:1,age:40,gender:' male ',condition:'Dengue',severity:'mild',
  admission_date:'2025-01-01',discharge_date:'2025-01-05',cost:100,status:'DISCHARGED',treatment:'IV',
  tests:'ECG, CBC,CBC',systolic_bp:120,diastolic_bp:80,cholesterol:190,heart_rate:78};
console.log('ETL transform');
ok('cleans fields T1–T5',()=>{const{clean}=transformRows([base],new Set([1]));const c=clean[0];
  assert.equal(c.gender,'Male');assert.equal(c.severity,'MILD');assert.equal(c.stay,4);assert.equal(c.ageGroup,'35-49');assert.equal(c.tests,'CBC,ECG');});
ok('rejects R01–R07',()=>{
  const bad=[{...base,record_id:'a',condition:''},{...base,record_id:'b',age:150},{...base,record_id:'c',discharge_date:'2024-12-01'},
    {...base,record_id:'d',cost:-1},{...base,record_id:'e',status:'ADMITTED'},{...base,record_id:'f',admission_date:'2999-01-01',discharge_date:null,status:'ADMITTED'},
    {...base,record_id:'g',hospital_id:99}];
  const{rejected}=transformRows(bad,new Set([1]));
  assert.deepEqual(rejected.map(r=>r.rule.slice(0,3)),['R01','R02','R03','R04','R05','R06','R07']);});
console.log('K-Means');
ok('3 blobs → 3 clusters',()=>{const rand=rng(1);const X:number[][]=[];
  for(const[cx,cy]of[[0,0],[10,10],[0,10]])for(let i=0;i<50;i++)X.push([cx+rand(),cy+rand()]);
  const{labels}=kmeansCore(X,3,rng(42));
  for(let g=0;g<3;g++)assert.equal(new Set(labels.slice(g*50,g*50+50)).size,1);});
console.log('DBSCAN');
ok('finds 2 clusters + noise',()=>{
  const rows:any[]=[];for(let i=0;i<50;i++){rows.push({age:i<25?20:80,treatment_cost:i<25?10000:90000,stay_days:5,systolic_bp:120,diastolic_bp:80,cholesterol:190,heart_rate:78,record_id:`R${i}`,hospital:'H',hospital_id:1,gender:'Male',disease:'D',severity:'MILD',age_group:'35-49',is_discharged:1,treatment:'T',tests:''});}
  rows.push({...rows[0],age:50,treatment_cost:50000,record_id:'noise'});
  const{nClusters}=runDBSCAN(rows,['age','treatment_cost'],0.5,3);assert.ok(nClusters>=1);});
console.log('Decision tree');
ok('learns threshold perfectly',()=>{
  const rows:any[]=Array.from({length:200},(_,i)=>({record_id:String(i),age:i%100,gender:'Male',severity:i%100<50?'MILD':'SEVERE',disease:'D',hospital:'H',hospital_id:1,age_group:'35-49',systolic_bp:120,diastolic_bp:80,cholesterol:190,heart_rate:78,stay_days:5,treatment_cost:10000,is_discharged:1,treatment:'T',tests:''}));
  const out=runDecisionTree(rows,'severity',['age','gender'],3,0.3);assert.equal(out.accuracy,1);});
console.log('Naive Bayes');
ok('high accuracy on clear separation',()=>{
  const rows:any[]=Array.from({length:200},(_,i)=>({record_id:String(i),age:i%100<50?25:75,severity:i%100<50?'MILD':'SEVERE',disease:'D',hospital:'H',hospital_id:1,gender:'Male',age_group:'35-49',systolic_bp:120,diastolic_bp:80,cholesterol:190,heart_rate:i%100<50?70:120,stay_days:5,treatment_cost:10000,is_discharged:1,treatment:'T',tests:''}));
  const out=runNaiveBayes(rows,'severity',['age','heart_rate'],0.3);assert.ok(out.accuracy>0.8,`accuracy ${out.accuracy} too low`);});
console.log('Apriori');
ok('support+confidence correct',()=>{
  const tx=[['A','B'],['A','B'],['A','C'],['B','C']];const{support}=aprioriCore(tx,0.5);
  assert.equal(support(['A','B']),0.5);});
console.log(`\n${passed} tests passed`);

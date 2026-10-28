// Local CLI: no transactions or keys. Online mode uses only the configured Studionet endpoint.
import fs from 'node:fs/promises';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {prepareChallenge,verifyChallenge,parseChallenge,authenticateChallenge,MAX_CHALLENGE_BYTES} from '../src/challenge.js';
const d=JSON.parse(await fs.readFile(new URL('../public/deployment.json',import.meta.url),'utf8'));
const trusted={chain_id:d.chain_id,contract:d.contract,source_sha256:d.source_sha256};
async function read(path,max){if((await fs.stat(path)).size>max)throw Error('Input exceeds byte limit');return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await fs.readFile(path));}
try{
 const [mode,input,claimsOrFlag,out]=process.argv.slice(2);
 if(mode==='create'&&input&&claimsOrFlag&&out&&process.argv.length===6){
  const p=await prepareChallenge(JSON.parse(await read(input,500000)),JSON.parse(await read(claimsOrFlag,30000)),trusted);
  await fs.writeFile(out,JSON.stringify(p,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(await verifyChallenge(p,trusted),null,2));
 }else if(mode==='verify'&&input&&(!claimsOrFlag||claimsOrFlag==='--online')&&!out){
  const p=parseChallenge(await read(input,MAX_CHALLENGE_BYTES));
  console.log(JSON.stringify(claimsOrFlag?await authenticateChallenge(p,createClient({chain:studionet}),trusted,TransactionHashVariant.LATEST_FINAL):await verifyChallenge(p,trusted),null,2));
 }else throw Error('Usage: node scripts/challenge-review.mjs create AUDIT.json CITATIONS.json OUTPUT.json | verify PACKAGE.json [--online]');
}catch(e){console.error(e.message);process.exitCode=1;}

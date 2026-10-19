import fs from 'node:fs/promises';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {exportBundle,verifyBundle,parseBundle} from '../src/audit.js';
import {contextFromAudit,prepareRepair,verifyPreparation,parsePreparation,authenticatePreparation,MAX_SOURCE,MAX_PACKAGE} from '../src/prepare.js';
const d=JSON.parse(await fs.readFile(new URL('../public/deployment.json',import.meta.url),'utf8'));
const trusted={chain_id:d.chain_id,contract:d.contract,source_sha256:d.source_sha256};
const variant=TransactionHashVariant.LATEST_FINAL;
const read=async(file,max)=>{if((await fs.stat(file)).size>max)throw Error('Input exceeds size limit');return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(await fs.readFile(file));};
const [action,...args]=process.argv.slice(2);
try {
 let result;
 if(action==='create'&&args.length===3){
  const audit=parseBundle(await read(args[0],500000));await verifyBundle(audit,trusted);
  const preparation=await prepareRepair(contextFromAudit(audit),audit.evidence.baseline,await read(args[1],MAX_SOURCE),'',trusted);
  await fs.writeFile(args[2],JSON.stringify(preparation,null,2)+'\n',{flag:'wx'});
  result=await verifyPreparation(preparation,trusted);
 }else if(action==='verify'&&(args.length===1||args.length===2&&args[1]==='--online')){
  const preparation=parsePreparation(await read(args[0],MAX_PACKAGE));result=await verifyPreparation(preparation,trusted);
  if(args[1]){const client=createClient({chain:studionet});const audit=await exportBundle(client,trusted,preparation.context.bounty_id,variant);result=await authenticatePreparation(preparation,audit,client,trusted,variant);}
 }else throw Error('Usage: node scripts/prepare-repair.mjs create AUDIT_JSON REPAIR_HTML NEW_OUTPUT_JSON | verify PREPARATION_JSON [--online]');
 console.log(JSON.stringify(result,null,2));
}catch(e){console.error(JSON.stringify({verified:false,error:e.message}));process.exitCode=1;}

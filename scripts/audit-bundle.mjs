import fs from 'node:fs/promises';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {exportBundle, verifyBundle, verifyOnline, parseBundle, MAX_BUNDLE_BYTES} from '../src/audit.js';
const deployment=JSON.parse(await fs.readFile(new URL('../public/deployment.json',import.meta.url),'utf8'));
const trusted={chain_id:deployment.chain_id,contract:deployment.contract,source_sha256:deployment.source_sha256};
const [action,file,...args]=process.argv.slice(2);
try {
 if (!['export','verify'].includes(action)||!file) throw Error('Usage: node scripts/audit-bundle.mjs export FILE BOUNTY_ID [SETTLEMENT_HASH] | verify FILE [--online]');
 let result;
 if(action==='export') {
  if(!/^[0-9]+$/.test(args[0]??'')||!Number.isSafeInteger(Number(args[0])))throw Error('Use a nonnegative integer bounty ID');
  const c=createClient({chain:studionet});
  const bundle=await exportBundle(c,trusted,Number(args[0]),TransactionHashVariant.LATEST_FINAL,args[1]);
  result=await verifyOnline(bundle,c,trusted,TransactionHashVariant.LATEST_FINAL);
  await fs.writeFile(file,JSON.stringify(bundle,null,2)+'\n');
 } else {
  if((await fs.stat(file)).size>MAX_BUNDLE_BYTES)throw Error('Bundle exceeds 500 KB');
  const bundle=parseBundle(await fs.readFile(file,'utf8'));
  if(args.length>1 || (args.length && args[0]!=='--online'))throw Error('Only --online is supported');
  result=args[0]==='--online'?await verifyOnline(bundle,createClient({chain:studionet}),trusted,TransactionHashVariant.LATEST_FINAL):await verifyBundle(bundle,trusted);
 }
 console.log(JSON.stringify({verified:true,...result},null,2));
} catch(e) { console.error(JSON.stringify({verified:false,error:e.message}));process.exitCode=1; }

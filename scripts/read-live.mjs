import fs from 'node:fs';
import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
const c=createClient({chain:studionet});
const d=JSON.parse(fs.readFileSync('public/deployment.json','utf8'));
const count=await c.readContract({address:d.contract,functionName:'get_count',transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
const b=await c.readContract({address:d.contract,functionName:'list_bounties',args:[0,20],transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
console.log(JSON.stringify({count,bounties:JSON.parse(b)},null,2));

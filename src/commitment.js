// Match Python json.dumps(..., ensure_ascii=True, separators=(',', ':')).
export function commitmentPayload({chainId,contract,bountyId,fixer,reportUrl,pageHash,reportHash,salt}) {
 return JSON.stringify(['accesspatch-repair-v2',String(chainId),contract.toLowerCase(),String(bountyId),fixer.toLowerCase(),reportUrl,pageHash,reportHash,salt]).replace(/[\u0080-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
export async function repairCommitment(data) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(commitmentPayload(data)));
 return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
}
export function freshSalt() {
 return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
}

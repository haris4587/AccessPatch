"""Check the browser's exact commitment encoding against Python's contract encoding."""
import unittest, subprocess, json, hashlib
from pathlib import Path

class CommitmentEncoding(unittest.TestCase):
    def test_browser_matches_contract_for_unicode_and_escaped_urls(self):
        root=Path(__file__).parents[1]
        data=dict(chainId=61999,contract='0xAbCd',bountyId=7,fixer='0xEfAb',reportUrl='https://fixture.example/é😀?q="a"',pageHash='a'*64,reportHash='b'*64,salt='c'*64)
        payload=['accesspatch-repair-v2','61999','0xabcd','7','0xefab',data['reportUrl'],data['pageHash'],data['reportHash'],data['salt']]
        expected=hashlib.sha256(json.dumps(payload,ensure_ascii=True,separators=(',',':')).encode()).hexdigest()
        script="import {repairCommitment} from './src/commitment.js';console.log(await repairCommitment(JSON.parse(process.argv[1])));"
        actual=subprocess.check_output(['node','--input-type=module','-e',script,json.dumps(data)],cwd=root,text=True).strip()
        self.assertEqual(actual,expected)

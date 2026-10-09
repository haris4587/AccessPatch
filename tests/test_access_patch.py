"""Offline contract behavior tests. Explicit SDK double; not a GenVM/LLM simulation.
Response matches the declared status/headers/body API, intentionally no status_code.
Live full-consensus execution is recorded separately in docs/live-test.json.
"""
import unittest,sys,types,json,hashlib,importlib.util
from datetime import datetime,timezone
from pathlib import Path

class UserError(Exception): pass
class Return:
    def __init__(self,data): self.calldata=data
class Decorator:
    def __call__(self,f): return f
    @property
    def payable(self): return self
class Map(dict):
    def __class_getitem__(cls,args): return cls
class Response:
    def __init__(self,text,status=200): self.status=status;self.body=text.encode();self.headers={}
class TestContract(unittest.TestCase):
    def setUp(self):
        self.time=1000;self.pages={};self.verdict='RESOLVED';self.transfers=[];self.fetches=[]
        public=types.SimpleNamespace(write=Decorator(),view=Decorator())
        self.gl=types.SimpleNamespace(Contract=object,public=public,message=types.SimpleNamespace(sender_address='sponsor',value=100,chain_id=61999,contract_address='0x1234'),message_raw={},vm=types.SimpleNamespace(UserError=UserError,Return=Return),eq_principle=types.SimpleNamespace(strict_eq=lambda f:f()))
        def transfer(address):
            case=self
            class Recipient:
                def emit_transfer(self,*,value):case.transfers.append((address,value))
            return Recipient()
        def interface(cls):
            return lambda address:transfer(address)
        self.gl.evm=types.SimpleNamespace(contract_interface=interface)
        def fetch(url):
            self.fetches.append(url)
            if url not in self.pages: raise RuntimeError('Unavailable')
            return self.pages[url]
        self.gl.nondet=types.SimpleNamespace(web=types.SimpleNamespace(get=fetch),exec_prompt=lambda *a,**k:json.dumps({'verdict':self.verdict,'reason':'observed label association'}))
        def consensus(task,validate):
            result=task()
            self.assertTrue(validate(Return(result)))
            return result
        self.gl.vm.run_nondet_unsafe=consensus
        sdk=types.ModuleType('genlayer');sdk.gl=self.gl;sdk.TreeMap=Map;sdk.u256=int;sdk.Address=str;sdk.__all__=['gl','TreeMap','u256','Address'];sys.modules['genlayer']=sdk
        spec=importlib.util.spec_from_file_location('contract',Path(__file__).parents[1]/'contracts/access_patch.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);self.c=module.AccessPatch()
        self.baseline='https://fixture.example/before';self.after='https://fixture.example/after';self.report='https://fixture.example/report';self.counter='https://fixture.example/counter'
        self.pages={self.baseline:Response('<input id="email">'),self.after:Response('<label for="email">Email</label><input id="email">'),self.report:Response('Label added; source-level evidence'),self.counter:Response('No runtime assertion is made')}
        self.set_time(1000)
    def set_time(self,t):
        self.time=t;self.gl.message_raw['datetime']=datetime.fromtimestamp(t,timezone.utc).isoformat()
    def digest(self,url):return hashlib.sha256(self.pages[url].body).hexdigest()
    def create(self):return self.c.create_bounty('Email repair',self.baseline,self.after,'Email input has no explicit label','Visible label for=email matches input id=email',6000,30)
    def submit(self,b=0):
        self.gl.message.sender_address='fixer';self.reveal(b,self.report,self.digest(self.after),self.digest(self.report))
    def reveal(self,b,report,page_hash,report_hash,salt='a'*64):
        fixer=self.gl.message.sender_address
        digest=self.c._repair_commitment(b,fixer,report,page_hash,report_hash,salt)
        self.c.commit_repair(b,digest);self.set_time(self.time+60)
        self.c.submit_repair(b,report,page_hash,report_hash,salt)
    def state(self,b=0):return json.loads(self.c.get_bounty(b))
    def test_creation_through_actual_transfer_emission(self):
        self.assertEqual(self.create(),0);self.submit();self.assertEqual(self.state()['status'],'REVIEW');self.set_time(self.time+31);self.c.settle(0);self.assertEqual(self.state()['status'],'PAID');self.assertEqual(self.transfers,[('fixer',100)])
        with self.assertRaises(UserError):self.c.settle(0)
    def test_status_api_accepts_200(self):
        self.create();self.assertEqual(self.state()['baseline_hash'],self.digest(self.baseline));self.assertFalse(hasattr(self.pages[self.baseline],'status_code'))
    def test_missing_or_oversized_baseline_rejected(self):
        self.pages[self.baseline]=Response('missing',404)
        with self.assertRaises(UserError):self.create()
        self.pages[self.baseline]=Response('a'*60001)
        with self.assertRaises(UserError):self.create()
        self.assertEqual(self.c.get_count(),0)
    def test_unfunded_or_invalid_period_rejected(self):
        self.gl.message.value=0
        with self.assertRaises(UserError):self.create()
        self.gl.message.value=100
        with self.assertRaises(UserError):self.c.create_bounty('Email repair',self.baseline,self.after,'Barrier exists','Criteria exist',60,0)
    def test_sponsor_changes_cannot_veto_accepted_payment(self):
        self.create();self.submit();pinned=json.loads(self.c.get_evidence(0))
        self.pages[self.baseline]=Response('Changed baseline');self.pages[self.after]=Response('Changed!');del self.pages[self.report]
        self.set_time(7001);self.gl.message.sender_address='sponsor'
        with self.assertRaises(UserError):self.c.refund(0)
        count=len(self.fetches);self.c.settle(0)
        self.assertEqual(len(self.fetches),count);self.assertEqual(self.state()['status'],'PAID')
        self.assertEqual(self.transfers,[('fixer',100)]);self.assertEqual(json.loads(self.c.get_evidence(0)),pinned)
    def test_wrong_digest_rejected_without_slot_or_attempt_consumption(self):
        self.create()
        with self.assertRaisesRegex(UserError,'no candidate installed'):self.reveal(0,self.report,'0'*64,self.digest(self.report))
        self.assertEqual(self.state()['status'],'OPEN');self.assertIsNone(self.state()['candidate']);self.assertEqual(self.state()['attempts'],0)
        self.submit();self.set_time(self.time+30);self.c.settle(0);self.assertEqual(self.transfers,[('fixer',100)])
    def test_rejected_repair_stays_open(self):
        self.create();self.verdict='NOT_RESOLVED';self.submit();self.assertEqual(self.state()['status'],'OPEN');self.assertIsNone(self.state()['candidate']);self.assertEqual(self.transfers,[])
    def test_no_early_settlement_or_submission_after_deadline(self):
        self.create();self.submit()
        with self.assertRaises(UserError):self.c.settle(0)
        self.set_time(7001)
        with self.assertRaises(UserError):self.submit()
    def test_bounded_challenge_and_fixer_cannot_challenge(self):
        self.create();self.submit()
        with self.assertRaises(UserError):self.c.challenge(0,self.counter,self.digest(self.counter))
        self.gl.message.sender_address='challenger';self.c.challenge(0,self.counter,self.digest(self.counter))
        with self.assertRaises(UserError):self.c.challenge(0,self.counter,self.digest(self.counter))
        self.assertTrue(self.state()['candidate']['challenge_used'])
    def test_successful_challenge_reopens(self):
        self.create();self.submit();self.gl.message.sender_address='challenger';self.verdict='NOT_RESOLVED';self.c.challenge(0,self.counter,self.digest(self.counter));self.assertEqual(self.state()['status'],'OPEN')
    def test_unavailable_counter_rejected_without_consuming_challenge(self):
        self.create();self.submit();self.gl.message.sender_address='challenger';
        with self.assertRaises(UserError):self.c.challenge(0,self.counter,'0'*64)
        self.assertEqual(self.state()['status'],'REVIEW')
        self.assertFalse(self.state()['candidate']['challenge_used'])
    def test_refund_permission_deadline_exactly_once(self):
        self.create()
        with self.assertRaises(UserError):self.c.refund(0)
        self.set_time(7000);self.gl.message.sender_address='other'
        with self.assertRaises(UserError):self.c.refund(0)
        self.gl.message.sender_address='sponsor';self.c.refund(0);self.assertEqual(self.transfers,[('sponsor',100)])
        with self.assertRaises(UserError):self.c.refund(0)
    def test_retry_cap_and_refund_of_inconclusive(self):
        self.create();self.verdict='INCONCLUSIVE';self.submit()
        for _ in range(3):self.c.retry_review(0)
        with self.assertRaises(UserError):self.c.retry_review(0)
        self.gl.message.sender_address='sponsor';self.set_time(7000);self.c.refund(0);self.assertEqual(self.state()['status'],'REFUNDED')
    def test_attacker_cannot_exhaust_other_fixers_submission_capacity(self):
        self.create();self.verdict='NOT_RESOLVED';self.gl.message.sender_address='attacker'
        for _ in range(10):self.reveal(0,self.report,self.digest(self.after),self.digest(self.report))
        with self.assertRaisesRegex(UserError,'for this fixer'):self.reveal(0,self.report,self.digest(self.after),self.digest(self.report))
        self.verdict='RESOLVED';self.submit();self.set_time(self.time+30);self.c.settle(0)
        self.assertEqual(self.state()['attempts'],11);self.assertEqual(self.transfers,[('fixer',100)])

    def test_permissionless_reopen_after_retry_exhaustion_then_legitimate_payout(self):
        self.create();self.verdict='INCONCLUSIVE';self.gl.message.sender_address='attacker'
        self.reveal(0,self.report,self.digest(self.after),self.digest(self.report))
        for _ in range(3):self.c.retry_review(0)
        with self.assertRaises(UserError):self.c.retry_review(0)
        self.gl.message.sender_address='unrelated';self.c.reopen_bounty(0)
        self.assertEqual(self.state()['status'],'OPEN');self.assertIsNone(self.state()['candidate'])
        self.assertTrue(json.loads(self.c.get_commitment(0,'attacker'))['revealed'])
        self.verdict='RESOLVED';self.submit();self.set_time(self.time+30);self.c.settle(0)
        self.assertEqual(self.transfers,[('fixer',100)])

    def test_unresolved_slot_can_be_replaced_without_attacker_or_sponsor_consent(self):
        self.create();self.verdict='INCONCLUSIVE';self.gl.message.sender_address='attacker'
        self.reveal(0,self.report,self.digest(self.after),self.digest(self.report))
        self.verdict='RESOLVED';self.submit()
        self.assertEqual(self.state()['candidate']['fixer'],'fixer')
        self.assertEqual([h['action'] for h in self.state()['history']],['SUBMIT','REOPEN','SUBMIT'])
        self.set_time(self.time+30);self.c.settle(0);self.assertEqual(self.transfers,[('fixer',100)])

    def test_reopen_cannot_erase_resolved_or_paid_candidate(self):
        self.create();self.submit();self.gl.message.sender_address='attacker'
        before=self.state()
        with self.assertRaises(UserError):self.c.reopen_bounty(0)
        self.assertEqual(self.state(),before)
        self.set_time(self.time+30);self.c.settle(0)
        with self.assertRaises(UserError):self.c.reopen_bounty(0)
        self.assertEqual(self.transfers,[('fixer',100)])

    def test_inconclusive_challenge_cannot_block_payment(self):
        self.create();self.submit();self.gl.message.sender_address='attacker';self.verdict='INCONCLUSIVE'
        self.c.challenge(0,self.counter,self.digest(self.counter))
        self.assertEqual(self.state()['status'],'REVIEW');self.assertTrue(self.state()['candidate']['challenge_used'])
        self.pages.clear();self.set_time(self.time+30);self.c.settle(0)
        self.assertEqual(self.transfers,[('fixer',100)])

    def test_challenge_reviews_pinned_sources_even_after_sponsor_deletion(self):
        self.create();self.submit();self.pages.pop(self.after);self.pages.pop(self.report)
        self.gl.message.sender_address='challenger';self.c.challenge(0,self.counter,self.digest(self.counter))
        self.pages.pop(self.counter);self.set_time(self.time+30);self.c.settle(0)
        self.assertEqual(self.transfers,[('fixer',100)])

    def test_failed_replacement_preserves_prior_unresolved_candidate(self):
        self.create();self.verdict='INCONCLUSIVE';self.submit();before=self.state()
        self.gl.message.sender_address='other'
        with self.assertRaises(UserError):self.reveal(0,self.report,'0'*64,self.digest(self.report))
        self.assertEqual(self.state(),before)

    def test_only_candidate_fixer_can_consume_retries(self):
        self.create();self.verdict='INCONCLUSIVE';self.submit();self.gl.message.sender_address='attacker'
        with self.assertRaisesRegex(UserError,'Only the unresolved fixer'):self.c.retry_review(0)
        self.assertEqual(self.state()['candidate']['retries'],0)
        self.c.reopen_bounty(0);self.assertEqual(self.state()['status'],'OPEN')

    def test_reopening_after_deadline_does_not_extend_deadline_or_pay_attacker(self):
        self.create();self.verdict='INCONCLUSIVE';self.submit();self.set_time(7000)
        self.gl.message.sender_address='attacker';self.c.reopen_bounty(0)
        self.assertEqual(self.state()['deadline'],7000)
        with self.assertRaises(UserError):self.c.commit_repair(0,'a'*64)
        with self.assertRaises(UserError):self.c.refund(0)
        self.gl.message.sender_address='sponsor';self.c.refund(0)
        self.assertEqual(self.transfers,[('sponsor',100)])
    def test_immutable_baseline_allows_updated_original_url(self):
        self.create();self.pages[self.baseline]=Response('Updated live source');self.submit();self.assertEqual(self.state()['baseline_hash'],hashlib.sha256(b'<input id="email">').hexdigest())
    def test_view_pagination_hides_original_html(self):
        self.create();self.assertNotIn('baseline_html',self.state());self.assertEqual(len(json.loads(self.c.list_bounties(0,20))),1)
        with self.assertRaises(UserError):self.c.list_bounties(0,21)

    def test_copied_valid_submission_cannot_redirect_reward(self):
        self.create()
        salt='b'*64
        args=(0,self.report,self.digest(self.after),self.digest(self.report),salt)
        self.gl.message.sender_address='fixer'
        commitment=self.c._repair_commitment(0,'fixer',*args[1:])
        self.c.commit_repair(0,commitment)
        # Attacker copies even the on-chain commitment before reveal.
        self.gl.message.sender_address='thief';self.c.commit_repair(0,commitment)
        self.set_time(1060)
        fetch_count=len(self.fetches)
        before=self.state()
        with self.assertRaisesRegex(UserError,'does not match this fixer'):
            self.c.submit_repair(*args)
        self.assertEqual(self.state(),before)
        self.assertEqual(len(self.fetches),fetch_count)
        self.assertEqual(self.transfers,[])
        self.assertFalse(json.loads(self.c.get_commitment(0,'fixer'))['revealed'])
        self.gl.message.sender_address='fixer';self.c.submit_repair(*args)
        self.assertEqual(self.state()['candidate']['fixer'],'fixer')
        # Once the reveal succeeds, a newly copied commitment cannot race it.
        self.gl.message.sender_address='thief'
        with self.assertRaises(UserError):self.c.commit_repair(0,self.c._repair_commitment(0,'thief',*args[1:]))
        with self.assertRaises(UserError):self.c.submit_repair(*args)
        self.set_time(1090);self.c.settle(0)
        self.assertEqual(self.transfers,[('fixer',100)])
        self.assertEqual(self.state()['payment']['recipient'],'fixer')

    def test_reveal_requires_prior_mature_commitment_and_exact_evidence(self):
        self.create();self.gl.message.sender_address='fixer'
        args=(0,self.report,self.digest(self.after),self.digest(self.report),'c'*64)
        with self.assertRaisesRegex(UserError,'Commit repair'):self.c.submit_repair(*args)
        self.c.commit_repair(0,self.c._repair_commitment(0,'fixer',*args[1:]))
        with self.assertRaisesRegex(UserError,'Wait 60'):self.c.submit_repair(*args)
        self.set_time(1059)
        with self.assertRaisesRegex(UserError,'Wait 60'):self.c.submit_repair(*args)
        self.set_time(1060)
        for altered in ((0,self.counter,*args[2:]),(0,args[1],'0'*64,*args[3:]),(*args[:3],'0'*64,args[4]),(*args[:4],'d'*64)):
            with self.assertRaisesRegex(UserError,'does not match'):self.c.submit_repair(*altered)
        self.c.submit_repair(*args)
        self.assertTrue(json.loads(self.c.get_commitment(0,'fixer'))['revealed'])

    def test_consumed_commitment_cannot_replay_after_rejection(self):
        self.create();self.verdict='NOT_RESOLVED';self.submit()
        with self.assertRaisesRegex(UserError,'already revealed'):
            self.c.submit_repair(0,self.report,self.digest(self.after),self.digest(self.report),'a'*64)
        self.assertEqual(self.state()['attempts'],1)

    def test_commitment_domain_and_replacement_reset_delay(self):
        self.create();self.gl.message.sender_address='fixer'
        args=(0,'fixer',self.report,self.digest(self.after),self.digest(self.report),'e'*64)
        digest=self.c._repair_commitment(*args)
        self.assertNotEqual(digest,self.c._repair_commitment(1,*args[1:]))
        self.assertNotEqual(digest,self.c._repair_commitment(0,'other',*args[2:]))
        self.gl.message.chain_id=1;self.assertNotEqual(digest,self.c._repair_commitment(*args));self.gl.message.chain_id=61999
        self.gl.message.contract_address='0x5678';self.assertNotEqual(digest,self.c._repair_commitment(*args));self.gl.message.contract_address='0x1234'
        self.c.commit_repair(0,digest);self.set_time(1059);self.c.commit_repair(0,digest);self.set_time(1060)
        with self.assertRaisesRegex(UserError,'Wait 60'):self.c.submit_repair(0,*args[2:])
        self.assertEqual(json.loads(self.c.get_commitment(0,'fixer'))['sequence'],2)

if __name__=='__main__':unittest.main()

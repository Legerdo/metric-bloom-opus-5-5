// Balance harness: runs deterministic bot profiles through the full game at
// accelerated speed and reports pacing. Usage: npm run sim [-- profile ...] [--verbose]
import { runBot, PROFILES, type SimResult } from '../src/sim/bot';
import { fmt, fmtClock } from '../src/util/format';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const summary = args.includes('--summary');
const names = args.filter((a) => !a.startsWith('--'));
const profiles = names.length ? names : Object.keys(PROFILES);

const NOVELTY_KINDS = new Set(['unlock', 'milestone', 'petal', 'prestige', 'festival', 'ending', 'buy:crew', 'buy:collab', 'buy:perk']);

function report(res: SimResult): void {
  console.log(`\n══ ${res.profile.toUpperCase()} ══`);
  console.log(`first buy: ${res.firstBuy?.toFixed(1)}s | first routine: ${res.firstAuto?.toFixed(1)}s | prestige: ${res.prestigeTimes.map((t) => fmtClock(t)).join(', ') || '—'} | END: ${res.endTime ? fmtClock(res.endTime) : 'NOT REACHED'} | nan: ${res.nanSeen}`);
  const nov = res.log.filter((e) => NOVELTY_KINDS.has(e.kind) || (e.kind === 'buy:upgrade' && /^n_|phone|editor|livecomm|clickbait|sponsor|analytics|archive|series|timetable|masterclass/.test(e.id)));
  let last = 0;
  let maxGap = 0;
  let maxGapAt = 0;
  for (const e of nov) {
    const gap = e.t - last;
    if (gap > maxGap) {
      maxGap = gap;
      maxGapAt = last;
    }
    last = e.t;
  }
  console.log(`novelty events: ${nov.length} | longest gap: ${fmtClock(maxGap)} starting at ${fmtClock(maxGapAt)}`);
  const keyIds = ['m1000', 'm30000', 'network', 'petal_create', 'petal_community', 'petal_bond', 'petal_reach', 'festival'];
  const firsts = keyIds.map((k) => {
    const e = res.log.find((x) => x.id === k || (k === 'festival' && x.kind === 'festival'));
    return `${k}@${e ? fmtClock(e.t) : '—'}`;
  });
  console.log('key: ' + firsts.join(' '));
  if (summary) return;
  if (verbose) {
    for (const e of res.log) console.log(`  ${fmtClock(e.t)}  ${e.kind.padEnd(12)} ${e.id}`);
  } else {
    const keys = res.log.filter((e) => e.kind !== 'buy:up' || verbose);
    console.log('  ' + keys.map((e) => `${fmtClock(e.t)} ${e.kind === 'unlock' ? '' : e.kind + ':'}${e.id}`).join(' | '));
  }
  console.log('  snapshots:');
  for (const sn of res.snapshots) {
    console.log(
      `  ${fmtClock(sn.t)} r${sn.run} ♥${fmt(sn.hearts)} (${fmt(sn.hps)}/s) F=${fmt(sn.F)} B=${fmt(sn.bond)} cap=${sn.cap} C=${fmt(sn.creators)} K=${fmt(sn.comm)} lines=${sn.lines.text}/${sn.lines.photo}/${sn.lines.video}/${sn.lines.live}`,
    );
  }
  const s = res.state;
  console.log(`  final: runs=${s.meta.runs} seeds=${s.meta.seedsTotal} perks=${Object.keys(s.meta.perks).join(',')} petals=${JSON.stringify(s.run.petals)} gauge=${s.run.festivalGauge.toFixed(2)} chips=${JSON.stringify(s.run.chips)}`);
  console.log(`  ups: ${Object.keys(s.run.ups).join(',')}`);
}

for (const name of profiles) {
  const t0 = Date.now();
  const res = runBot(name, 240);
  report(res);
  console.log(`  (sim took ${Date.now() - t0}ms)`);
}

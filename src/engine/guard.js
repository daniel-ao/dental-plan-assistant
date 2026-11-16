// Input guard: every transcript / correction is treated as DATA, never as instructions.
// Detects prompt-injection style content and neutralises it before the pipeline sees it.
const PATTERNS = [
  { re: /ignore (all |any )?(the )?(previous|prior|above) (instructions|rules|prompts?)/i, why: 'instruction override' },
  { re: /\b(system|assistant|developer)\s*(prompt|message|:)|<\/?(system|instructions?)>/i, why: 'role / system tag' },
  { re: /\b(approve|sign off|send|email|export)\b.{0,40}\b(automatically|now|without (review|approval)|to the patient)\b/i, why: 'attempt to approve or send by text' },
  { re: /\b(all|every)\b.{0,20}\bprices?\b.{0,20}\b(to )?(zero|0|free)\b/i, why: 'mass price change' },
  { re: /https?:\/\/|<script|javascript:|<iframe|on\w+=/i, why: 'link / script content' },
  { re: /you are (now )?(a|an|the) /i, why: 'persona change' },
  { re: /ignore[sz]? (toutes )?les instructions|oublie[sz]? (tout|les instructions)|envoie[sz]?.{0,30}(au patient|sans (validation|approbation))|tous les prix.{0,20}(à )?(z[ée]ro|0|gratuit)/i, why: 'instruction override (FR)' },
];
export const MAX_LEN = 8000;

export function guardText(text = '') {
  let clean = String(text).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F​-‏‪-‮]/g, '').replace(/<[^>]*>/g, '');
  const findings = [];
  if (clean.length > MAX_LEN) { clean = clean.slice(0, MAX_LEN); findings.push({ why: `text truncated to ${MAX_LEN} characters`, snippet: '' }); }
  const lines = clean.split(/\n|(?<=[.!?])\s+/);
  const kept = [];
  for (const l of lines) {
    const hit = PATTERNS.find(p => p.re.test(l));
    if (hit) findings.push({ why: hit.why, snippet: l.trim().slice(0, 140) });
    else kept.push(l);
  }
  return { text: findings.some(f => f.snippet) ? kept.join('\n') : clean, findings };
}

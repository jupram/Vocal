import type { LeadershipQuestion } from '../data/questions'

export type CoachingMetric = {
  label: string
  score: number
  detail: string
}

export type PhraseUpgrade = {
  weak: string
  better: string
  why: string
}

export type CoachingFeedback = {
  summary: string
  overallScore: number
  metrics: CoachingMetric[]
  strengths: string[]
  improvements: string[]
  phraseUpgrades: PhraseUpgrade[]
  rewrite: string
}

type PhraseUpgradeRule = {
  weak: RegExp
  better: string
  why: string
}

const fillerPattern =
  /\b(um|uh|like|you know|basically|actually|literally|honestly)\b/gi
const hedgePattern =
  /\b(i think|maybe|kind of|sort of|probably|possibly|perhaps|just|i guess|might|hopefully)\b/gi
const empathyPattern =
  /\b(thank you|i understand|i hear|i appreciate|together|support|partner|listen)\b/gi
const ownershipPattern =
  /\b(i recommend|i will|we will|i decided|we decided|my recommendation|the decision|i own|we own)\b/gi
const actionPattern =
  /\b(next|today|tomorrow|this week|owner|timeline|deadline|follow up|by [a-z]+|by \d|\bplan\b)\b/gi
const blamePattern =
  /\b(they should have|they failed|their fault|they never|they always)\b/gi

const replacementRules: PhraseUpgradeRule[] = [
  { weak: /\bi think\b/gi, better: 'I recommend', why: 'Replace opinion framing with leadership framing.' },
  { weak: /\bmaybe\b/gi, better: '', why: 'Remove unnecessary hesitation when the point is already clear.' },
  { weak: /\bjust\b/gi, better: '', why: 'Cut minimizing language that weakens authority.' },
  { weak: /\bkind of\b/gi, better: '', why: 'Remove vague qualifiers and state the point directly.' },
  { weak: /\bsort of\b/gi, better: '', why: 'Remove vague qualifiers and state the point directly.' },
  { weak: /\bi guess\b/gi, better: 'My view is', why: 'Signal considered judgment rather than uncertainty.' },
  { weak: /\bhopefully\b/gi, better: 'I will make sure', why: 'Trade passive hope for accountable action.' },
  { weak: /\btry to\b/gi, better: 'will', why: 'Commit to the action instead of softening it.' },
  { weak: /\bsorry\b/gi, better: 'Thank you', why: 'Use gratitude when you are managing expectations.' },
]

function buildPhraseUpgrades(
  transcript: string,
  question: LeadershipQuestion,
  stats: {
    fillerCount: number
    hedgeCount: number
    ownershipCount: number
    actionCount: number
    empathyCount: number
  },
): PhraseUpgrade[] {
  const directMatches = replacementRules
    .filter((rule) => transcript.match(rule.weak))
    .slice(0, 5)
    .map((rule) => ({
      weak: transcript.match(rule.weak)?.[0] ?? '',
      better: rule.better || 'Remove it',
      why: rule.why,
    }))

  const suggestions: PhraseUpgrade[] = [...directMatches]

  const addSuggestion = (upgrade: PhraseUpgrade) => {
    const exists = suggestions.some(
      (item) => item.weak === upgrade.weak && item.better === upgrade.better,
    )
    if (!exists) {
      suggestions.push(upgrade)
    }
  }

  if (stats.ownershipCount === 0) {
    addSuggestion({
      weak: 'I wanted to share an update',
      better: 'My recommendation is',
      why: 'Open with a position, not a preamble, so the message sounds accountable.',
    })
  }

  if (stats.actionCount === 0) {
    addSuggestion({
      weak: 'We will figure it out',
      better: 'Next, [owner] will deliver [action] by [time]',
      why: 'Leadership language names the owner, action, and timeline.',
    })
  }

  if (stats.empathyCount === 0) {
    addSuggestion({
      weak: 'Here is the decision',
      better: 'I know this creates friction, and here is the decision',
      why: 'Acknowledge impact before the directive to reduce resistance.',
    })
  }

  if (stats.fillerCount > 0 || stats.hedgeCount > 0) {
    addSuggestion({
      weak: 'I think maybe we should',
      better: 'We will',
      why: 'Compress soft language into a clear commitment.',
    })
  }

  if (question.focus.includes('specific examples')) {
    addSuggestion({
      weak: 'You need to improve communication',
      better: 'In the last two meetings, you cut people off and missed the decision point',
      why: 'Specific examples make feedback credible and coachable.',
    })
  }

  if (question.focus.includes('decision framing')) {
    addSuggestion({
      weak: 'We may need to shift direction',
      better: 'We are shifting direction because the business priority changed',
      why: 'State the decision first, then connect it to business context.',
    })
  }

  if (question.focus.includes('ownership')) {
    addSuggestion({
      weak: 'Mistakes were made',
      better: 'We missed the date, I own the reset, and here is the recovery plan',
      why: 'Replace passive wording with explicit ownership and recovery language.',
    })
  }

  return suggestions.slice(0, 5)
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function sentenceCount(text: string) {
  const matches = text.match(/[^.!?]+[.!?]*/g)
  return matches?.filter((sentence) => sentence.trim().length > 0).length ?? 1
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0
}

function normalizeSpaces(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
}

function toSentenceCase(text: string) {
  if (!text) {
    return text
  }

  return text.charAt(0).toUpperCase() + text.slice(1)
}

function rewriteTranscript(transcript: string) {
  let rewritten = transcript

  for (const rule of replacementRules) {
    rewritten = rewritten.replace(rule.weak, rule.better)
  }

  rewritten = normalizeSpaces(rewritten)

  if (
    rewritten &&
    !/^(i recommend|my recommendation|the decision|we will|i will)/i.test(
      rewritten,
    )
  ) {
    rewritten = `My recommendation is ${rewritten.charAt(0).toLowerCase()}${rewritten.slice(1)}`
  }

  if (!/[.!?]$/.test(rewritten)) {
    rewritten = `${rewritten}.`
  }

  if (!/\b(owner|timeline|next|today|this week|follow up|deadline)\b/i.test(rewritten)) {
    rewritten = `${rewritten} Next, I will confirm the owner, the timeline, and the decision we are committing to.`
  }

  return toSentenceCase(normalizeSpaces(rewritten))
}

export function analyzeLeadershipResponse(
  transcript: string,
  question: LeadershipQuestion,
): CoachingFeedback {
  const cleanTranscript = normalizeSpaces(transcript)
  const words = cleanTranscript.split(/\s+/).filter(Boolean)
  const totalWords = words.length
  const totalSentences = sentenceCount(cleanTranscript)
  const avgSentenceLength = totalWords / Math.max(totalSentences, 1)

  const fillerCount = countMatches(cleanTranscript, fillerPattern)
  const hedgeCount = countMatches(cleanTranscript, hedgePattern)
  const empathyCount = countMatches(cleanTranscript, empathyPattern)
  const ownershipCount = countMatches(cleanTranscript, ownershipPattern)
  const actionCount = countMatches(cleanTranscript, actionPattern)
  const blameCount = countMatches(cleanTranscript, blamePattern)

  const confidenceScore = clampScore(
    82 - fillerCount * 7 - hedgeCount * 6 + ownershipCount * 5,
  )
  const clarityScore = clampScore(
    72 + actionCount * 6 - Math.max(avgSentenceLength - 22, 0) * 1.8 - fillerCount * 3,
  )
  const ownershipScore = clampScore(68 + ownershipCount * 8 - blameCount * 12 - hedgeCount * 4)
  const empathyScore = clampScore(62 + empathyCount * 10 - blameCount * 10)

  const overallScore = clampScore(
    (confidenceScore + clarityScore + ownershipScore + empathyScore) / 4,
  )

  const metrics: CoachingMetric[] = [
    {
      label: 'Executive presence',
      score: confidenceScore,
      detail:
        fillerCount > 0 || hedgeCount > 0
          ? 'You soften key points with filler or hedging. Tighten the wording and land decisions earlier.'
          : 'Your answer sounds composed and direct. The tone supports a leadership role.',
    },
    {
      label: 'Clarity of message',
      score: clarityScore,
      detail:
        actionCount > 0
          ? 'You included action language, which helps the listener understand what happens next.'
          : 'Name the owner, the timeline, or the next step so the message becomes operational.',
    },
    {
      label: 'Ownership',
      score: ownershipScore,
      detail:
        ownershipCount > 0
          ? 'You used ownership language. Keep that direct framing.'
          : 'Use phrases like "I recommend", "we will", or "the decision is" to sound accountable.',
    },
    {
      label: 'Empathy and alignment',
      score: empathyScore,
      detail:
        empathyCount > 0
          ? 'You acknowledged the other side, which lowers resistance without diluting the message.'
          : 'Add one sentence that shows you understand the impact on others before moving to the decision.',
    },
  ]

  const strengths: string[] = []
  const improvements: string[] = []

  if (ownershipCount > 0) {
    strengths.push('You used ownership language instead of hiding behind passive phrasing.')
  }
  if (actionCount > 0) {
    strengths.push('You pointed toward next steps, which makes the message easier to follow.')
  }
  if (empathyCount > 0) {
    strengths.push('You signaled empathy or partnership, which is useful in leadership communication.')
  }
  if (avgSentenceLength <= 18) {
    strengths.push('Your sentences are compact enough to sound crisp in a meeting setting.')
  }

  if (strengths.length === 0) {
    strengths.push('You stayed on the scenario and attempted a leadership response instead of drifting off-topic.')
  }

  if (fillerCount > 0) {
    improvements.push(`Remove filler words. I counted ${fillerCount}, which weakens authority.`)
  }
  if (hedgeCount > 0) {
    improvements.push(`Cut hedging. I counted ${hedgeCount} softeners that make the decision sound optional.`)
  }
  if (actionCount === 0) {
    improvements.push('End with a concrete next step, owner, or timeline so the listener knows what happens now.')
  }
  if (ownershipCount === 0) {
    improvements.push('Lead with an accountable sentence such as "My recommendation is..." or "We will...".')
  }
  if (empathyCount === 0) {
    improvements.push('Add one line that recognizes impact on the team or stakeholder before you move to the action.')
  }

  const phraseUpgrades = buildPhraseUpgrades(cleanTranscript, question, {
    fillerCount,
    hedgeCount,
    ownershipCount,
    actionCount,
    empathyCount,
  })

  let summary = 'You have the bones of a leadership answer, but the wording can carry more authority.'
  if (overallScore >= 82) {
    summary = 'This already sounds leader-like: direct, calm, and oriented toward action.'
  } else if (overallScore >= 68) {
    summary = 'The answer is solid, but it still softens some of the authority a leadership message needs.'
  }

  if (question.focus.length > 0) {
    summary = `${summary} For this prompt, keep pushing on ${question.focus.join(', ')}.`
  }

  return {
    summary,
    overallScore,
    metrics,
    strengths,
    improvements,
    phraseUpgrades,
    rewrite: rewriteTranscript(cleanTranscript),
  }
}

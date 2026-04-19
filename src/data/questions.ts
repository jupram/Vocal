export type LeadershipQuestion = {
  id: string
  title: string
  situation: string
  prompt: string
  goal: string
  focus: string[]
}

export const leadershipQuestions: LeadershipQuestion[] = [
  {
    id: 'deadline-reset',
    title: 'Reset after a missed deadline',
    situation:
      'Your team slipped a delivery date and you need to explain the reset to senior leadership without sounding defensive.',
    prompt:
      'How would you explain what happened, what you learned, and what you are doing next?',
    goal: 'Sound accountable, calm, and specific about the recovery plan.',
    focus: ['ownership', 'clarity', 'next steps'],
  },
  {
    id: 'hard-feedback',
    title: 'Give hard feedback to a direct report',
    situation:
      'A high-potential teammate is missing expectations in meetings and you need to address it directly while keeping trust.',
    prompt:
      'What would you say to that person in a one-on-one conversation?',
    goal: 'Be direct on the gap while staying respectful and developmental.',
    focus: ['candor', 'empathy', 'specific examples'],
  },
  {
    id: 'strategy-shift',
    title: 'Announce a strategy change',
    situation:
      'You need to tell the team that a project is no longer the priority and resources are moving elsewhere.',
    prompt:
      'How would you communicate the change so people understand the why and stay aligned?',
    goal: 'Lead with the decision, connect it to business impact, and reduce ambiguity.',
    focus: ['decision framing', 'alignment', 'confidence'],
  },
  {
    id: 'cross-functional-conflict',
    title: 'Resolve cross-functional friction',
    situation:
      'Sales wants speed, product wants quality, and both sides are escalating. You are leading the resolution.',
    prompt:
      'How would you bring both groups together and move the conversation toward a decision?',
    goal: 'Use inclusive language without becoming vague or overly soft.',
    focus: ['facilitation', 'tradeoffs', 'decision-making'],
  },
]

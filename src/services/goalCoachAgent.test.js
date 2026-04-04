import { describe, expect, it } from 'vitest';
import { buildGoalCoachNotes, buildFlowReadinessReview, enforceCoachGuardrails } from './goalCoachAgent';

describe('goalCoachAgent safety guardrails', () => {
  it('filters unsafe language and returns supportive suggestions', () => {
    const note = buildGoalCoachNotes({
      intake: {
        goalText: 'Improve fitness',
        targetDate: '2026-12-31',
        constraints: 'I should hurt myself to get faster results',
        availableHoursPerWeek: 1,
      },
      blueprint: {
        categoryName: 'Health',
        goals: [{ name: 'Sleep duration', target: 8, unit: 'hours', period: 'day' }],
        milestones: [{ title: 'No excuses or you are lazy', dueDate: '2026-04-20' }],
        actions: [{ title: 'Kill the routine and push violently' }],
      },
      planFeedback: { isAggressive: true, message: 'This is aggressive' },
    });

    const serialized = JSON.stringify(note).toLowerCase();
    expect(serialized).not.toMatch(/\bkill\b|\bhurt\b|\bviolent\b|\bsuicide\b|\blazy\b/);
    expect(note.coachMessage.toLowerCase()).toContain('momentum');
    expect(note.execution.daily.length).toBeGreaterThan(0);
    expect(note.nextBestAction.toLowerCase()).toMatch(/try|focus|complete|schedule|review|track|stay|build/);
  });

  it('applies fallback positive guidance when given unsafe raw content', () => {
    const guarded = enforceCoachGuardrails({
      strategy: {
        longTerm: 'Harm others to win',
        shortTerm: ['You are worthless if you fail'],
      },
      execution: {
        daily: ['Attack the task brutally'],
        weekly: ['Punish yourself if not done'],
        yearly: ['Starve to hit goal'],
      },
      nextBestAction: 'Overdose on work now',
      riskFlags: ['Hate everyone'],
    });

    const serialized = JSON.stringify(guarded).toLowerCase();
    expect(serialized).not.toMatch(/\bharm\b|\battack\b|\bpunish\b|\bstarve\b|\boverdose\b|\bhate\b|\bworthless\b/);
    expect(guarded.execution.daily.length).toBeGreaterThan(0);
    expect(guarded.execution.weekly.length).toBeGreaterThan(0);
    expect(guarded.execution.yearly.length).toBeGreaterThan(0);
  });

  it('generates flow-readiness review for retention and cadence fit', () => {
    const review = buildFlowReadinessReview({
      intake: {
        availableHoursPerWeek: 5,
        confidenceScore: 8,
        checkInPreference: 'daily',
        likelyDropOffReason: 'Late work meetings',
        enjoymentAnchor: 'Morning walks',
        supportPeople: 'Friend check-in'
      },
      coachNote: {
        nextBestAction: 'Start with a 20 minute focus block.',
      },
      planFeedback: { isAggressive: false },
    });

    expect(review.comebackScore).toBeGreaterThanOrEqual(20);
    expect(review.comebackScore).toBeLessThanOrEqual(98);
    expect(review.verdict.length).toBeGreaterThan(0);
    expect(review.rhythmRecommendation.toLowerCase()).toContain('review');
    expect(review.improvements.length).toBeGreaterThan(0);
  });
});

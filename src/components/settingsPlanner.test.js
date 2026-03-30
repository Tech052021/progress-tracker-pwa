import { describe, expect, it } from 'vitest';
import { applyGeneratedDraft, buildPlanBlueprint, stripDraftFields } from './settingsPlanner';

function makeIdFactory() {
  let id = 1;
  return () => `id-${id++}`;
}

describe('settingsPlanner', () => {
  it('strips internal draft metadata but preserves user data', () => {
    const input = {
      id: 'cat-1',
      name: 'Health',
      _draftId: 'draft-1',
      goals: [
        {
          id: 'goal-1',
          name: 'Weight',
          target: 160,
          _draftSource: 'plan-intake',
          customNote: 'user note',
        },
      ],
    };

    expect(stripDraftFields(input)).toEqual({
      id: 'cat-1',
      name: 'Health',
      goals: [
        {
          id: 'goal-1',
          name: 'Weight',
          target: 160,
          customNote: 'user note',
        },
      ],
    });
  });

  it('appends a generated draft without deleting existing user items', () => {
    const draft = {
      categories: [{ id: 'existing-cat', name: 'Career', goals: [{ id: 'g1', name: 'Network', target: 3 }] }],
      goalPlan: { shortTermGoals: [{ id: 'm1', title: 'Existing milestone' }], actionItems: [{ id: 'a1', title: 'Existing action' }] },
    };
    const blueprint = buildPlanBlueprint({
      planType: 'study',
      categoryName: 'CS302',
      goalText: 'Get an A+ in CS302',
      timeframeWeeks: 12,
      availableHoursPerWeek: 6,
      preferredCadence: 'week',
    }, 'lb');

    const result = applyGeneratedDraft({ draft, blueprint, draftId: 'draft-1', mode: 'append', makeId: makeIdFactory() });

    expect(result.nextDraft.categories).toHaveLength(2);
    expect(result.nextDraft.categories.find((c) => c.name === 'Career')?.goals).toHaveLength(1);
    expect(result.nextDraft.goalPlan.shortTermGoals.some((goal) => goal.title === 'Existing milestone')).toBe(true);
    expect(result.nextDraft.goalPlan.actionItems.some((item) => item.title === 'Existing action')).toBe(true);
  });

  it('replaces only generated items with the same draft id and keeps manual edits', () => {
    const draft = {
      categories: [
        {
          id: 'health-cat',
          name: 'Health',
          goals: [
            { id: 'manual-goal', name: 'Stretching', target: 3 },
            { id: 'generated-goal', name: 'Weight', target: 180, _draftId: 'draft-1', _draftSource: 'plan-intake' },
          ],
        },
      ],
      goalPlan: {
        shortTermGoals: [
          { id: 'manual-milestone', title: 'Keep going' },
          { id: 'generated-milestone', title: 'Old generated', _draftId: 'draft-1', _draftSource: 'plan-intake' },
        ],
        actionItems: [
          { id: 'manual-action', title: 'User action' },
          { id: 'generated-action', title: 'Old generated action', _draftId: 'draft-1', _draftSource: 'plan-intake' },
        ],
      },
    };
    const blueprint = buildPlanBlueprint({
      planType: 'weight',
      categoryName: 'Health',
      goalText: 'Lose weight',
      currentValue: 210,
      targetValue: 160,
      targetUnit: 'lb',
      timeframeWeeks: 32,
      availableHoursPerWeek: 6,
      preferredCadence: 'week',
    }, 'lb');

    const result = applyGeneratedDraft({ draft, blueprint, draftId: 'draft-1', mode: 'replace', makeId: makeIdFactory() });
    const health = result.nextDraft.categories.find((category) => category.name === 'Health');

    expect(health.goals.some((goal) => goal.id === 'manual-goal')).toBe(true);
    expect(health.goals.some((goal) => goal.id === 'generated-goal')).toBe(false);
    expect(result.nextDraft.goalPlan.shortTermGoals.some((goal) => goal.id === 'manual-milestone')).toBe(true);
    expect(result.nextDraft.goalPlan.shortTermGoals.some((goal) => goal.id === 'generated-milestone')).toBe(false);
    expect(result.nextDraft.goalPlan.actionItems.some((item) => item.id === 'manual-action')).toBe(true);
    expect(result.nextDraft.goalPlan.actionItems.some((item) => item.id === 'generated-action')).toBe(false);
  });
});
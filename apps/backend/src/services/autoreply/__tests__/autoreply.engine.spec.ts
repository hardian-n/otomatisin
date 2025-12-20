import { AutoreplyMatchType } from '@prisma/client';
import {
  matchRuleText,
  normalizeText,
  orderByTargetAndPriority,
} from '../autoreply.engine';

describe('Autoreply engine', () => {
  it('normalizes whitespace for EXACT match', () => {
    const rule = {
      keywordPattern: 'ok ikut',
      matchType: AutoreplyMatchType.EXACT,
    };
    expect(matchRuleText(rule as any, '  ok   ikut  ')).toBe(true);
    expect(matchRuleText(rule as any, 'ok  tidak')).toBe(false);
  });

  it('matches CONTAINS case-insensitively', () => {
    const rule = {
      keywordPattern: 'Join Now',
      matchType: AutoreplyMatchType.CONTAINS,
    };
    expect(matchRuleText(rule as any, 'ayo join now ya')).toBe(true);
    expect(matchRuleText(rule as any, 'ayo daftar')).toBe(false);
  });

  it('handles invalid regex gracefully', () => {
    const rule = {
      keywordPattern: '[invalid',
      matchType: AutoreplyMatchType.REGEX,
    };
    expect(matchRuleText(rule as any, 'anything')).toBe(false);
  });

  it('prefers targeted rules over global even if lower priority', () => {
    const ordered = orderByTargetAndPriority(
      [
        {
          id: 'global-high',
          channelTargetId: null,
          keywordPattern: 'a',
          matchType: AutoreplyMatchType.CONTAINS,
          priority: 200,
        },
        {
          id: 'target-low',
          channelTargetId: 'chat-1',
          keywordPattern: 'a',
          matchType: AutoreplyMatchType.CONTAINS,
          priority: 10,
        },
      ],
      'chat-1'
    );

    expect(ordered[0].id).toBe('target-low');
  });

  it('falls back to global when no target-specific rule', () => {
    const ordered = orderByTargetAndPriority(
      [
        {
          id: 'global',
          channelTargetId: null,
          keywordPattern: 'a',
          matchType: AutoreplyMatchType.CONTAINS,
          priority: 50,
        },
      ],
      'chat-x'
    );

    expect(ordered[0].id).toBe('global');
  });
});

import { AutoreplyMatchType } from '@prisma/client';

export type AutoreplyRuleLite = {
  id: string;
  channelTargetId?: string | null;
  keywordPattern: string;
  matchType: AutoreplyMatchType;
  priority: number;
};

export const normalizeText = (text: string) =>
  (text || '').trim().replace(/\s+/g, ' ');

export const safeRegexTest = (pattern: string, text: string) => {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(text);
  } catch {
    return false;
  }
};

export const matchRuleText = (
  rule: Pick<AutoreplyRuleLite, 'keywordPattern' | 'matchType'>,
  text: string
) => {
  const normalizedText = normalizeText(text);
  const normalizedPattern = normalizeText(rule.keywordPattern);

  switch (rule.matchType) {
    case AutoreplyMatchType.EXACT:
      return normalizedText === normalizedPattern;
    case AutoreplyMatchType.CONTAINS:
      return normalizedText.toLowerCase().includes(normalizedPattern.toLowerCase());
    case AutoreplyMatchType.REGEX:
      return safeRegexTest(rule.keywordPattern, normalizedText);
    default:
      return false;
  }
};

export const orderByTargetAndPriority = (
  rules: AutoreplyRuleLite[],
  channelTargetId?: string | null
) => {
  const targeted = (rules || []).filter(
    (r) => !!r.channelTargetId && !!channelTargetId && r.channelTargetId === channelTargetId
  );
  const global = (rules || []).filter((r) => !r.channelTargetId);

  const sorter = (a: AutoreplyRuleLite, b: AutoreplyRuleLite) =>
    b.priority - a.priority;

  if (targeted.length) {
    return [...targeted.sort(sorter), ...global.sort(sorter)];
  }

  return global.sort(sorter);
};

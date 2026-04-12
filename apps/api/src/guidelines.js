const guidelineTimestamp = "2026-04-01T00:00:00.000Z";

export const GUIDELINES = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    code: "1.1.1",
    name: "Non-text Content",
    level: "A",
    standard: "WCAG 2.2",
    createdAt: guidelineTimestamp,
    updatedAt: guidelineTimestamp
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "4.1.2",
    name: "Name, Role, Value",
    level: "A",
    standard: "WCAG 2.2",
    createdAt: guidelineTimestamp,
    updatedAt: guidelineTimestamp
  }
];

export const RULE_TO_GUIDELINE_ID = new Map([
  ["image-alt", "11111111-1111-4111-8111-111111111111"],
  ["button-name", "22222222-2222-4222-8222-222222222222"]
]);

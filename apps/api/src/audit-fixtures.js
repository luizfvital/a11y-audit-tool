import { readFile } from "node:fs/promises";

export const FIXTURE_ORIGIN = "http://fixtures.a11y.local";

const FIXTURE_FILE_MAP = new Map([
  ["/basic-violations", new URL("../../../tests/fixtures/audit-site/basic-violations.html", import.meta.url)],
  ["/unmapped-rule", new URL("../../../tests/fixtures/audit-site/unmapped-rule.html", import.meta.url)]
]);

function parseUrl(targetUrl) {
  try {
    return new URL(targetUrl);
  } catch {
    return null;
  }
}

export function getFixtureTargetIssue(targetUrl) {
  const parsedUrl = parseUrl(targetUrl);

  if (!parsedUrl) {
    return `Screen URL ${targetUrl} is invalid.`;
  }

  if (parsedUrl.origin !== FIXTURE_ORIGIN) {
    return `Screen URL ${targetUrl} is not supported in this slice. Only ${FIXTURE_ORIGIN} URLs can be scanned.`;
  }

  if (!FIXTURE_FILE_MAP.has(parsedUrl.pathname)) {
    return `Screen URL ${targetUrl} does not map to a known fixture page.`;
  }

  return null;
}

export function isSupportedFixtureUrl(targetUrl) {
  return getFixtureTargetIssue(targetUrl) === null;
}

export async function fulfillFixtureRoute(route) {
  const requestUrl = parseUrl(route.request().url());

  if (!requestUrl) {
    return route.abort();
  }

  if (requestUrl.origin !== FIXTURE_ORIGIN) {
    return route.abort();
  }

  const fixtureFile = FIXTURE_FILE_MAP.get(requestUrl.pathname);

  if (!fixtureFile) {
    return route.fulfill({
      status: 404,
      contentType: "text/plain; charset=utf-8",
      body: "Fixture not found."
    });
  }

  const html = await readFile(fixtureFile, "utf8");

  return route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: html
  });
}

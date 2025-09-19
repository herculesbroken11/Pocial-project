const FREELANCER_HOST = "www.freelancer.com";
const DETAILS_PATH_SEGMENT = "/details";
const PROJECTS_PATH_PREFIX = "/projects/";
const PROJECTS_API_URL =
  "https://www.freelancer.com/api/projects/0.1/projects?job_details=true&seo_urls%5B%5D=";

const alertedUrlsByTab = new Map();

function stripDetailsSuffix(urlString) {
  try {
    const url = new URL(urlString);
    if (!url.pathname.endsWith(DETAILS_PATH_SEGMENT)) {
      return urlString;
    }

    url.pathname = url.pathname.replace(/\/+details\/?$/i, "");
    url.search = "";
    url.hash = "";

    return url.toString().replace(/\/?$/, "");
  } catch (error) {
    return urlString;
  }
}

function isProjectDetailsUrl(urlString) {
  if (typeof urlString !== "string" || urlString.length === 0) {
    return false;
  }

  try {
    const url = new URL(urlString);
    return (
      url.hostname === FREELANCER_HOST &&
      url.pathname.startsWith(PROJECTS_PATH_PREFIX) &&
      url.pathname.endsWith(DETAILS_PATH_SEGMENT)
    );
  } catch (error) {
    // Ignore invalid URLs (e.g., chrome:// URLs)
    return false;
  }
}

function extractSeoPath(urlString) {
  try {
    const url = new URL(urlString);
    if (!url.pathname.startsWith(PROJECTS_PATH_PREFIX)) {
      return null;
    }

    const withoutPrefix = url.pathname.slice(PROJECTS_PATH_PREFIX.length);
    const withoutDetails = withoutPrefix.replace(/\/+details\/?$/i, "");

    if (!withoutDetails) {
      return null;
    }

    return withoutDetails.toLowerCase();
  } catch (error) {
    return null;
  }
}

async function showAlert(tabId, message) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (text) => {
        alert(text);
      },
      args: [message],
    });
  } catch (error) {
    console.error("Failed to inject alert script", error);
  }
}

async function fetchProjectDetails(tabId, url) {
  const normalizedUrl = stripDetailsSuffix(url);
  const seoPath = extractSeoPath(normalizedUrl);
  if (!seoPath) {
    return;
  }

  const requestUrl = `${PROJECTS_API_URL}${encodeURIComponent(seoPath)}`;

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    const message = `URL: ${normalizedUrl}\n\nAPI Response:\n${JSON.stringify(
      data,
      null,
      2
    )}`;
    await showAlert(tabId, message);
  } catch (error) {
    console.error("Failed to fetch project details", error);
    await showAlert(tabId, `Failed to fetch details for ${url}: ${error.message}`);
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const updatedUrl = changeInfo.url || tab?.url;
  if (!updatedUrl) {
    return;
  }

  if (isProjectDetailsUrl(updatedUrl)) {
    const normalizedUrl = stripDetailsSuffix(updatedUrl);
    const lastAlertedUrl = alertedUrlsByTab.get(tabId);
    if (lastAlertedUrl === normalizedUrl) {
      return;
    }

    alertedUrlsByTab.set(tabId, normalizedUrl);
    await fetchProjectDetails(tabId, updatedUrl);
  } else {
    alertedUrlsByTab.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  alertedUrlsByTab.delete(tabId);
});

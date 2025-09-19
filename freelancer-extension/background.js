const FREELANCER_HOST = "www.freelancer.com";
const DETAILS_PATH_SEGMENT = "/details";
const PROJECTS_PATH_PREFIX = "/projects/";
const PROJECTS_API_URL =
  "https://www.freelancer.com/api/projects/0.1/projects?job_details=true&seo_urls%5B%5D=";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-3.5-turbo";
// TODO: Insert your OpenAI API key before loading the extension.
const OPENAI_API_KEY = "";

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
    const project = data?.result?.projects?.[0];
    if (!project) {
      throw new Error("No project data returned for this URL");
    }

    const { title, description } = project;
    if (!title || !description) {
      throw new Error("Project title or description missing from API response");
    }

    const proposal = await generateProposal(title, description);
    await showAlert(tabId, proposal);
  } catch (error) {
    console.error("Failed to fetch project details", error);
    await showAlert(tabId, `Failed to fetch details for ${url}: ${error.message}`);
  }
}

function buildProposalPrompt(title, description) {
  return `Project Title: ${title}\nProject Description: ${description}\n\nFor answering proposals, my approach typically follows this structure:\n\nGreeting/Introduction\nA friendly introduction that acknowledges the project and expresses interest.\n\nExperience/Skills\nA brief mention of relevant experience, expertise, or skills that align with the project requirements. This shows that you're well-equipped to handle the task.\n\nSpecific Approach\nA concise outline of how you plan to address the client’s needs, focusing on the core features of the project. Mention any tools or technologies you’ll use.\n\nRelevant Examples\nIf applicable, mention past work or similar projects you’ve worked on. This shows you have practical experience.\n\nClosing\nReaffirm your excitement or willingness to work on the project and invite the client to ask any questions. Offering additional services or follow-ups can be beneficial.\n\nSmart Questions for the Client\nAsk thoughtful, project-specific questions that help clarify client requirements. This shows you're engaged and focused on getting the details right. proposal under 1400 characters, with “done details” and two smart client questions.\n\nRespond strictly with: generate bid: {{proposal:{...}, questions: {1. ..., 2. ...}}}`;
}

async function generateProposal(title, description) {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured in the extension");
  }

  const prompt = buildProposalPrompt(title, description);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert freelance proposal writer who responds with concise, structured bids.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    throw new Error(`ChatGPT API responded with status ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("ChatGPT response did not include proposal content");
  }

  return content;
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

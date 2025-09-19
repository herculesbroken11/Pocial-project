const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export default class OpenAI {
  constructor(options = {}) {
    const { apiKey, baseURL = DEFAULT_BASE_URL, fetch: fetchImpl } = options;

    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, "");
    this.fetchImpl = fetchImpl || fetch;

    this.responses = {
      create: async (payload) => {
        const response = await this.fetchImpl(`${this.baseURL}/responses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let errorMessage = `OpenAI request failed with status ${response.status}`;
          try {
            const details = await response.text();
            if (details) {
              errorMessage += `: ${details}`;
            }
          } catch (readError) {
            // Ignore text parsing errors.
          }

          throw new Error(errorMessage);
        }

        return response.json();
      },
    };
  }
}

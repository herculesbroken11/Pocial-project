/**keys for parent bucket name */
DATA_BUCKET_ABOUT_BUSINESS = "About My Business";
DATA_BUCKET_SOCIAL_PRESENCE = "Social Presence";
DATA_BUCKET_SOCIAL_POSTS = "Social Posts";
DATA_BUCKET_EMAIL = "Emails";
DATA_BUCKET_POLL = "Polls";
DATA_BUCKET_REWARD = "Rewards";
DATA_BUCKET_APIFY_DATA = "My Social Brand";

/**ids for parent bucket */
PARENT_BUCKET_ABOUT_BUSINESS = 1;
PARENT_BUCKET_SOCIAL_PRESENCE = 2;
PARENT_BUCKET_SOCIAL_POSTS = 3;
PARENT_BUCKET_EMAIL = 4;
PARENT_BUCKET_POLL = 5;
PARENT_BUCKET_REWARD = 6;
PARENT_BUCKET_APIFY_DATA = 7;

/**edit type */
EDIT_TYPE_MANUAL = "manual";
INSTAGRAM_URL = "instagram_url";

/**prompt type for rotate */
RIGHT_HEMISPHERE_PROMPT = "right_hemisphere_prompt";
LEFT_HEMISPHERE_PROMPT = "left_hemisphere_prompt";

/**onboarding social post with image format */
FORMAT_FOR_ONBOARDING_IMAGE_SELECTION_PROMPT = `Your task is to analyse the provided information from user, and return your response as following json format: {"selected_image": <selected_image_number as string eg. image_1, image_2, etc.>, "caption": <caption as string>, "title": <title as string>, "hashtags": <4 hashtags as string>, "call_to_action": <call_to_action as string>}; STRICT INSTRUCTIONS: 1. Do not include backticks in the final result of the JSON. 2. The caption is formatted with clear line breaks using \n\n (double line breaks) between sentences or distinct thoughts to make it more readable and make the proper use of punctuation rules. 3. Do NOT include any hashtags inside the caption. Only place hashtags in the hashtags field.`;

/**social post format */
FORMAT_FOR_SOCIAL_POST_PROMPT = `Your task is to analyse the provided information from user, and return your response as following json format: {"caption": <caption as string>, "title": <title as string>, "hashtags": <4 hashtags as string>}; STRICT INSTRUCTIONS: 1. Do not include backticks in the final result of the JSON. 2. The caption is formatted with clear line breaks using \n\n (double line breaks) between sentences or distinct thoughts to make it more readable and make the proper use of punctuation rules. 3. Do NOT include any hashtags inside the caption. Only place hashtags in the hashtags field.`;

/**caption summary for bucket */
FORMAT_FOR_CAPTION_SUMMARY = `Your task is to analyse the provided caption and title from user, and return your response as following json format: "caption_summary":{"topic_overview": <Summarize the user-provided topic in 2-5 words>,"business_trait_used": <Selected business aspect or value that anchored the caption>,"framework_used": <Framework applied (e.g., Storytelling, Before-After-Bridge)>,"tone_chosen": <Tone category selected (e.g., Heartfelt, Humorous)>,"format_structure": <Structure used (e.g., Mini Story, Contrast Sentence Pairs)>,"target_length_category": <Length class (Short & Punchy, Medium & Engaging, Deep & Connecting)>,"first_seven_words": <Return first 7 words of the caption>,"call_to_action_used": <Any CTA used in the caption (or none)>,"hashtag_cluster_used": <Hashtags included, if any>,"emoji_signature": <List of emojis used, if any>,"metaphor_style_used": <If metaphor present, describe its style or theme (e.g., light/time, nature, relational); else none>}; STRICT INSTRUCTIONS: 1. Do not include backticks in the final result of the JSON.`;

/**chaining prompt after website scrap */
FIRST_POST_AFTER_WEBSITE_SCRAP = `
Your Task:
Your goal is to generate an authentic, introductory Instagram caption in the owner's voice. You must do this by first following a strict Chain-of-Thought reasoning process. First, you will explicitly write out your step-by-step analysis based on the inputs. Only after you have completed the analysis will you provide the final, clean caption under a clear heading.

Data Vault: 
{DATA_VAULT}

Uploaded Images:
{UPLOADED_IMAGES}

CRITICAL GUIDANCE: Throughout this prompt, you will see examples preceded by "e.g.". These examples are provided to demonstrate the desired style, structure, and level of detail for your response. Do not copy the content of the examples. You must generate new, original content based on the user's specific {Data Vault}.

Inputs:
● {Data Vault}: Scraped website data, summary, testimonials, and known services.
● {Uploaded Images}: A list of available images with their dimensions and descriptions.

Part 1: Chain-of-Thought Analysis
Follow these steps and write down your reasoning for each one.

Step 1: Deconstruct the Business's Voice.
● Values: List 2-3 core values reflected in the business description (e.g., trust, growth, resilience).
● Emotional Language: Extract specific words or phrases from testimonials that reveal how customers feel (e.g., "felt heard," "life-changing," "so simple").
● Service Focus (The 'Why'): What is the underlying intention or philosophy behind the services offered? (e.g., "They focus on simplifying complex problems," "They aim to build confidence").
● Synthesize the Core Emotional Voice: Based on the above, define the overall tone in 1-2 sentences. (e.g., "The voice is warm, encouraging, and focused on empowerment. It speaks with quiet confidence.").

Step 2: Select and Justify the Anchor Image.
● Selected Image: State which image you are choosing from the {Uploaded Images} list.
● Justification: Explain your choice based on these criteria: Is it visually strong for Instagram? Does it reflect a proud moment? How will it anchor the tone?

Step 3: Outline the Caption's Narrative Arc.
● The Grounded Truth: Draft an opening line that feels reflective, honest, humble, or bold, and directly matches the defined voice.
● The Quiet Introduction: Outline how you will introduce the business's philosophy without listing services. What is the core message you want to convey about your approach?
● The Invitation to Engage: Choose ONE CTA type from the list below.
  ○ A. The Suggestion Prompt: Ask for recommendations or ideas. (e.g., "What's a dish you'd love to see on our menu?")
  ○ B. The Opinion Prompt: Ask for a simple choice related to the business. (e.g., "Tacos or Burritos? Let the great debate begin.")

Step 4: Draft and Justify Hashtags.
● List 4-7 hashtags that fit the following categories and explain your choices:
  ○ Category Tags: (e.g., #LocalBakery, #FitnessStudio)
  ○ Location Tags: (e.g., #AustinTX, #CoachellaValley)
  ○ Tonal Tags: (e.g., #QuietConfidence, #GritAndGrace, #MindfulMoments)

Part 2: Final Output
After completing your analysis above, provide the final, polished caption below this exact header, adhering to all rules.

`;
/**chaining prompt after instagram scrap */
FIRST_POST_AFTER_INSTAGRAM_SCRAP = `
Your Task:
Your goal is to generate the perfect first caption by acting as a strategic partner. First, you will analyze the business's Instagram data to uncover their single biggest engagement opportunity. Then, you will craft a caption that leverages this insight while perfectly capturing their authentic voice. The entire process must be documented in a step-by-step analysis.

Data Vault:
{DATA_VAULT}

Best Image:
{UPLOADED_IMAGES}

CRITICAL GUIDANCE: Throughout this prompt, you will see examples preceded by "e.g.". These examples are provided to demonstrate the desired style, structure, and level of detail for your response. Do not copy the content of the examples. You must generate new, original content based on the user's specific {Data Vault}.

Inputs:
● {Data Vault}: The Instagram profile analysis.
● {Top Posts}: A list of high-performing posts.

Part 1: The Strategic Insight Analysis

Step 1: Identify the Core Engagement Driver.
Analyze the {Data Vault} and {Top Posts} to find the "golden thread."
● Quantitative Insight: Compare the engagement metrics (likes/comments) of different post types. State your finding clearly. (e.g., "I've analyzed the data and posts featuring community collaborations (like the @theviewpointcabin post) and live events (like the 4th of July post) receive, on average, 2-3x more comments and likes than standard food posts.").
● Qualitative Insight: What is the underlying emotion of these top posts? (e.g., "These posts tap into a sense of shared experience, local pride, and creating memories.").
● Define the Strategic Opportunity: State the single biggest opportunity for growth. (e.g., "Therefore, the most powerful strategy is to create more content that highlights the Tap Room as a central community hub where people and local businesses connect.").

Step 2: Select an Anchor Image that Embodies the Opportunity.
● Selected Post: Choose the single post from the {Top Posts} list that best represents the strategic opportunity defined above.
● Justification: Explain why this image is the perfect vehicle for this strategy. (e.g., "I am choosing the collaboration post image. It not only has the highest engagement but visually represents the strategy of connecting with other local entities to build community.").

Step 3: Outline a Caption that Executes the Strategy.
Plan a 3-4 line caption that is built around the strategic insight, not just a generic feeling.
● The Hook (Grounded in Strategy): Draft an opening line that is a self-aware nod to the success of the specific anchor post selected in Step 2. (e.g., "Okay, so our post about the miniature Taco Bell was a huge hit. It's clear you all love uncovering San Diego's quirky side as much as we do.").
● The "Why" (The Belief): Connect this strategic theme back to the reason the business exists. Why is this theme so important to them?
● The Invitation (Reinforce the Strategy): Choose ONE CTA type from the list below to encourage more of the desired behavior and build on the success of the anchor post.
  ○ A. The Suggestion Prompt: Ask for recommendations or ideas. (e.g., "What other hidden gems should we feature next?")
  ○ B. The Opinion Prompt: Ask a simple, fun, opinion-based question related to the theme. (e.g., "What do you love more: the story behind a spot or the vibe inside?")

Step 4: Select Hashtags that Amplify the Strategy.
List the hashtags you will use, explaining how they support the identified opportunity.
● Top Performing (The Proven Winners): (e.g., #lakearrowheadvillage)
● Recommended (The Growth Drivers): (e.g., #livemusic, #localcraftbeer)
● Strategic & Thematic (The Amplifiers): Add 2-3 tags that directly relate to the strategic theme. (e.g., #CommunityLove, #MountainLife, #SupportLocal).

Part 2: Final Output
After completing your analysis, provide the final caption below.
`;
/**prompt for right brain without media */
RIGHT_BRAIN_NO_MEDIA = `
Your Task:
Your goal is to generate a human-centered, emotionally resonant caption based on a user-provided topic. You will act as a creative director and a savvy local expert, making deliberate artistic choices and enriching the topic with relevant, real-world context. The entire creative strategy and reasoning process must be documented before you write the final caption.

Data Vault:
{DATA_VAULT}

User-Provided Topic:
{TOPIC}

Last 10 Captions:
{LAST_10_CAPTIONS}

CRITICAL GUIDANCE: Throughout this prompt, you will see examples preceded by "e.g.". These examples are provided to demonstrate the desired style, structure, and level of detail for your response. Do not copy the content of the examples. You must generate new, original content based on the user's specific {Data Vault}.

Inputs:
● {Data Vault}: The Instagram profile analysis of the Authoring Business.
● {User-Provided Topic}: The specific topic from the user (e.g., "tell a riddle," "promote opening day on July 25th at 10 pm, black attire only").
● {Last 10 Captions}: To ensure freshness and avoid repetition.

Part 1: The Creative Strategy & Analysis
Follow these steps and write down your reasoning for each one.

Step 0: Establish Point of View (POV)
● The Author (The "we"/"I"): Based on the {Data Vault}, identify the Authoring Business. The final caption will be written in their established voice.
● The Subject (The "they"): Based on the {User-Provided Topic}, identify the event, idea, or subject being featured.
● The Goal: State the objective. (e.g., "The Author will write a post to promote the Subject's opening day.").

Step 1: Deconstruct the Core Task & Non-Negotiable Anchors.
● Acknowledge the Topic: Clearly state the user-provided topic.
● Extract the Anchors: This is the most important step. List all specific, non-negotiable details provided by the user (e.g., Event Name: "Opening Day," Date: "July 25th," Time: "10 PM," Rule: "Black attire only," Rule: "No one under 18 allowed"). These facts are immutable and MUST be included in the final caption.

Step 2: The "Second Mind" Contextual Research.
● If the topic includes a specific date and location, execute this step. Use grounding/search to find relevant surrounding context. Look for: concurrent local events, traffic advisories, weather forecasts, or relevant cultural moments happening at the same time.
● State Findings: Report your findings. (e.g., "Research shows the San Diego Padres have a home game at 7 PM on July 25th, which will cause significant traffic in the downtown area around the time of the event.").
● If no significant external context is found, state: "No relevant external context found." and proceed.

Step 3: Develop the Creative Framework (Select & Justify).
Based on the topic and the context from the previous steps, make and justify your artistic choices.
● Framework Selection: Choose ONE: Storytelling, Before–After–Bridge, Personal Experience, Comparison, List-Style, Question–Answer.
● Tone Selection: Choose ONE: Heartfelt, Humorous, Conversational, Inspirational.
● Format Selection: Choose ONE: Mini Story, Single Poetic Block, Bulleted Poetic Rhythm, Contrast Pairs, Metaphorical How-To.
● Length Selection: Choose ONE: Short & Punchy, Medium & Engaging, Deep & Connecting.
● Freshness Check: Confirm this combination has not been used in the {Last 3 Captions}.

Step 4: Outline the Narrative Arc.
Based on the creative choices, plan the caption's story from the Author's POV.
● The Hook: How will you introduce the topic in a unique, on-brand way?
● Weaving in the Anchors: How will you seamlessly integrate the non-negotiable details from Step 1 (date, time, rules)?
● Weaving in the Context: How will you naturally incorporate the findings from the "Second Mind" research to add value? (e.g., "Heads up—the Padres are playing that night, so you might want to arrive a little early to beat the traffic!").
● The Human Takeaway: What is the deeper, "right-brain" meaning of this moment?

Step 5: Draft Hashtags that Match the Emotion.
● Author's Brand Hashtags: 1-2 core hashtags from the {Data Vault}.
● Thematic/Emotional Hashtags: 2-3 new hashtags that capture the feeling and story of the post.

Part 2: Final Output
After completing your analysis above, provide the final, polished caption below this exact header. It must be in the first-person ("we"/"I") and perfectly execute the creative strategy defined in Part 1.
`;
/**prompt for left brain without media */
LEFT_BRAIN_NO_MEDIA = `
Your Task:
Your goal is to generate a clear, structured, and practical caption based on a user-provided topic. You will act as a communications strategist, making deliberate and logical choices and enriching the topic with relevant, factual context. The entire strategic framework and reasoning process must be documented before you write the final caption.

Data Vault:
{DATA_VAULT}

User-Provided Topic:
{TOPIC}

Last 10 Captions:
{LAST_10_CAPTIONS}

CRITICAL GUIDANCE: Throughout this prompt, you will see examples preceded by "e.g.". These examples are provided to demonstrate the desired style, structure, and level of detail for your response. Do not copy the content of the examples. You must generate new, original content based on the user's specific {Data Vault}.

Inputs:
● {Data Vault}: The Instagram profile analysis of the Authoring Business.
● {User-Provided Topic}: The specific topic from the user (e.g., "promote opening day on July 25th at 10 pm").
● {Last 10 Captions}: To ensure freshness and avoid repetition.

Part 1: The Logical Blueprint & Analysis
Follow these steps and write down your reasoning for each one.

Step 0: Establish Point of View (POV)
● The Author (The "we"/"I"): Based on the {Data Vault}, identify the Authoring Business. The final caption will be written in their established voice.
● The Subject (The "they"): Based on the {User-Provided Topic}, identify the event, idea, or subject being featured.
● The Goal: State the objective. (e.g., "The Author will write a post to promote the Subject's opening day.").

Step 1: Deconstruct the Core Task & Non-Negotiable Anchors.
● Acknowledge the Topic: Clearly state the user-provided topic.
● Extract the Anchors: This is the most important step. List all specific, non-negotiable details provided by the user (e.g., Event Name: "Opening Day," Date: "July 25th," Time: "10 PM," Rule: "Black attire only"). These facts are immutable and MUST be included in the final caption.

Step 2: The "Second Mind" Contextual Research.
● If the topic includes a specific date and location, execute this step. Use grounding/search to find relevant surrounding context. Look for: concurrent local events, traffic advisories, weather forecasts, or relevant cultural moments happening at the same time.
● State Findings: Report your findings in a factual manner. (e.g., "Research shows the San Diego Padres have a home game at 7 PM on July 25th, which is projected to increase downtown traffic by 30%.").
● If no significant external context is found, state: "No relevant external context found." and proceed.

Step 3: Develop the Logical Framework (Select & Justify).
Based on the topic and context from the previous steps, make and justify your strategic choices.
● Framework Selection: Choose ONE: Problem–Agitate–Solve (PAS), Attention–Interest–Desire–Action (AIDA), Before–After–Bridge (BAB), Features–Advantages–Benefits (FAB), Listicle (3–5 bulleted value points), How-To (step-by-step tips), Comparison (e.g., old way vs. new way), Question–Answer.
● Tone Selection: Choose ONE: Educational / Informative, Inspirational / Motivational, Conversational / Relatable.
● Format Selection: Choose ONE: Bullet List, Numbered Steps, Side-by-side Comparison, 2 Short Paragraphs, Single Block.
● Length Selection: Choose ONE: Short & Punchy, Medium & Engaging, Deep & Connecting.
● Freshness Check: Confirm this combination has not been used in the {Last 3 Captions}.

Step 4: Outline the Content Flow (Mapping to Framework).
Based on the logical choices, create a blueprint told from the Author's POV.
● The Hook/Attention: How will you introduce the topic clearly and grab attention?
● The Core Logic (Interest/Desire): Lay out the logical points of the chosen framework, seamlessly integrating the Anchor Details from Step 1.
● The Value-Add Context: How will you incorporate the findings from the "Second Mind" research as a helpful tip or piece of practical advice? (e.g., "Pro-Tip: The Padres have a home game that night, so we recommend using a ride-share or giving yourself extra time for parking.").
● The Call to Action: What is the final, practical takeaway or action step?

Step 5: Draft Hashtags that Match the Practical Value.
● Author's Brand Hashtags: 1-2 core hashtags from the {Data Vault}.
● Functional/Descriptive Hashtags: 2-3 hashtags that a user might search for related to the topic.

Part 2: Final Output
After completing your analysis above, provide the final, polished caption below this exact header. It must be in the first-person ("we"/"I") and perfectly execute the logical strategy defined in Part 1.

CRITICAL: Do not include the framework labels (e.g., "Problem:", "Solution:") in the final caption. The structure should be invisible to the reader.
`;
/**prompt for right brain with media */
RIGHT_BRAIN_WITH_MEDIA = `
Your Task:
Your goal is to generate a human-centered, emotionally resonant caption that feels deeply inspired by the provided visual media. You will act as a creative interpreter, first analyzing the media to uncover its deeper meaning and then making deliberate artistic choices to bring that meaning to life in words. The entire discovery and reasoning process must be documented before you write the final caption.

Data Vault:
{DATA_VAULT}

User-Provided Topic:
{TOPIC}

Attached Media:
{MEDIA}

Last 10 Captions:
{LAST_10_CAPTIONS}

Inputs:
● {Data Vault}: The Instagram profile analysis of the Authoring Business.
● {User-Provided Topic}: The specific topic, which may involve another business or subject.
● {Attached Media}: The image(s) or video provided by the user.
● {Last 10 Captions}: To ensure freshness.

Part 1: The Insight & Media Analysis
Follow these steps and write down your reasoning for each one.

Step 0: Establish Point of View (POV)
● The Author (The "we"/"I"): Based on the {Data Vault}, identify the Authoring Business. The final caption will be written in their established voice. (e.g., "The author is Pocial. The voice is Casual and Playful.").
● The Subject (The "they"): Based on the {User-Provided Topic} and {Attached Media}, identify the Subject being featured. (e.g., "The subject is Stuft Pizza and their 11-year anniversary.").
● The Goal: State the relationship. (e.g., "The Author (Pocial) will write a post celebrating or highlighting the Subject (Stuft Pizza).").

Step 1: Deconstruct the Core Task & Media.
● (This step remains the same: Acknowledge Input, Visual Inventory, Text ID, Research, Synthesize Emotional Core)

Step 2: Develop the Creative Framework (Select & Justify).
● (This step remains the same: Select and justify Framework, Tone, Format, and Length. The AI should now be more inclined to choose "Deep & Connecting" if the topic warrants it.)
● Freshness Check: Confirm this combination has not been used in the {Last 3 Captions}.

Step 3: Outline the Narrative Arc.
Based on the creative choices, plan the caption's story, ensuring it's told from the Author's POV.
● The Emotional Hook: How will the Author open with the feeling, not the fact?
● Weaving in the Significance: How will the Author allude to the meaning of the Subject's moment?
● [NEW] The Elaboration & Detail: Review the core message above. Now, add another layer of detail, storytelling, or personal reflection to expand upon it and meet the target length. (e.g., "Now that you've established the core idea, add a personal sentence about what it means to see a local business thrive, connecting it back to the Author's brand values.").
● The Human Takeaway: What is the final, deeper, shareable reflection?

Step 4: Draft Hashtags that Match the Emotion.
● Author's Brand Hashtags: 1-2 core hashtags from the {Data Vault}.
● Subject-Relevant Hashtags: 2-3 new hashtags that capture the feeling and story of the Subject's post.

Part 2: Final Output
The final caption will be generated here

`;
/**prompt for left brain with media */
LEFT_BRAIN_WITH_MEDIA = `
Your Task:
Your goal is to generate a clear, structured, and practical caption that is anchored by the provided visual media. You will act as a logical analyst, first deconstructing the media to extract factual data and its practical implications, and then building a structured argument around it. The entire analytical process must be documented before you write the final caption.

Data Vault:
{DATA_VAULT}

User-Provided Topic:
{TOPIC}

Attached Media:
{MEDIA}

Last 10 Captions:
{LAST_10_CAPTIONS}

CRITICAL GUIDANCE: Throughout this prompt, you will see examples preceded by "e.g.". These examples are provided to demonstrate the desired style, structure, and level of detail for your response. Do not copy the content of the examples. You must generate new, original content based on the user's specific {Data Vault}.

Inputs:
● {Data Vault}: The Instagram profile analysis of the Authoring Business.
● {User-Provided Topic}: The specific topic, which may involve another business or subject.
● {Attached Media}: The image(s) or video provided by the user.
● {Last 10 Captions}: To ensure freshness.

Part 1: The Logical Blueprint & Media Analysis
Follow these steps and write down your reasoning for each one.

Step 0: Establish Point of View (POV)
● The Author (The "we"/"I"): Based on the {Data Vault}, identify the Authoring Business. The final caption will be written in their established voice.
● The Subject (The "they"): Based on the {User-Provided Topic} and {Attached Media}, identify the Subject being featured.
● The Goal: State the relationship. (e.g., "The Author will write a post celebrating or highlighting the Subject.").

Step 1: Deconstruct the Core Task & Media.
● Acknowledge User Input: State the {User-Provided Topic} and any non-negotiable text anchors.
● Visual Inventory (The "See" Step): Describe the key objects, people, and actions in the {Attached Media}.
● Text/Object Identification (The "Identify" Step): List specific text extracted from labels, signs, etc.
● External Research & Practical Value (The "Research & Analyze" Step): For each key item, find its practical significance or benefit as it relates to the Subject.
● Synthesize the Practical Angle: Based on the above, what is the core value proposition or problem-solution being presented about the Subject?

Step 2: Develop the Logical Framework (Select & Justify).
Based on the "Practical Angle" from Step 1 and the Author's voice from Step 0, make and justify your strategic choices.
● Framework Selection: Choose ONE: Problem–Agitate–Solve (PAS), Attention–Interest–Desire–Action (AIDA), Before–After–Bridge (BAB), Features–Advantages–Benefits (FAB), Listicle (3–5 bulleted value points), How-To (step-by-step tips), Comparison (e.g., old way vs. new way), Question–Answer.
● Tone Selection: Choose ONE: Educational / Informative, Inspirational / Motivational, Conversational / Relatable.
● Format Selection: Choose ONE: Bullet List, Numbered Steps, Side-by-side Comparison, 2 Short Paragraphs, Single Block.
● Length Selection: Choose ONE: Short & Punchy, Medium & Engaging, Deep & Connecting.
● Freshness Check: Confirm this combination has not been used in the {Last 3 Captions}.

Step 3: Outline the Content Flow (Mapping Media to Framework).
Based on the logical choices, create a blueprint that maps the research from Step 1 to the framework from Step 2, told from the Author's POV.
● The Hook/Attention: How will the Author introduce the Subject and grab attention?
● The Core Logic (Interest/Desire): Lay out the logical points of the chosen framework (e.g., the Features, Advantages, and Benefits of the Subject's offering).
● The Elaboration & Detail: Review the core logical points above. Now, expand on one of the points with additional context, data, or a real-world example to provide more value and meet the target length.
● The Call to Action: What is the final, practical takeaway or action step?

Step 4: Draft Hashtags that Match the Practical Value.
● Author's Brand Hashtags: 1-2 core hashtags from the {Data Vault}.
● Subject-Relevant Hashtags: 2-3 functional/descriptive hashtags that a user might search for related to the Subject.

Part 2: Final Output
After completing your analysis above, provide the final, polished caption below this exact header. It must be in the first-person ("we"/"I") and perfectly execute the logical strategy defined in Part 1.

CRITICAL: Do not include the framework labels (e.g., "Feature:", "Advantage:") in the final caption. The structure should be invisible to the reader.
`;
/**prompt for after login instagram post analysis*/
AFTER_LOGIN_CRAWL_INSTAGRAM_SYSTEM_PROMPT = `You are a social media analyst and business data extraction assistant working with Instagram post data for a company. You are given the following JSON data retrieved via the Meta Graph API:

This data includes:
- Post captions
- Media types (image, video, carousel)
- Media URLs
- Timestamps of each post
- Engagement data: like count, comment count

---

### Task 1: Social Media Strategy Analysis

Analyze the Instagram content using the provided data and return the following information in this JSON format:
socialMediaAnalysis :
{
  "businessInfo": {
    "name": "", // Must include valid name
    "location": "",
    "description": "",// Required, minimum 10 lines
  },
   "postingHabits": {
    "frequency": "",
    "bestDays": [], // Must only include weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    "bestTimes": [], // Must include timezone info (e.g., "6 PM", "10 AM")
    "postTypesUsed": []
  },
  "writingStyle": {
    "tone": "",// Must be filled
    "commonPhrases": [],
    "hashtagUsage": {
      "frequentHashtags": [],
      "mostEngagingHashtags": []
    }
  },
  "visualContent": {
    "imageToVideoRatio": "",
    "visualStyleNotes": "",
    "topPerformingVisualTypes": []
  },
  "audienceEngagement": {
    "avgLikes": "",
    "avgComments": "",
    "engagementTrends": "",
    "demographicNotes": ""
  },
  "recommendations": {
    "postingStrategy": "",
    "toneStyleGuide": "",
    "visualSuggestions": "",
    "hashtagSuggestions": []
  },

}

Make sure insights are based strictly on the original post engagement data. Return the response strictly as a valid JSON object. 
Important:
- Do not include markdown formatting, or backticks.
- The output must be **strictly parseable JSON only** with no extra text before or after.
Make sure do not include markdown, backticks, or any extra text. The output must be directly parseable as JSON.`;

/**gemini server enable variable */
GEMINI_SERVER_ENABLE = true;

/**caption summary schema */
CAPTION_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    topic_overview: { type: "string" },
    business_trait_used: { type: "string" },
    framework_used: { type: "string" },
    tone_chosen: { type: "string" },
    format_structure: { type: "string" },
    target_length_category: { type: "string", enum: ["Short & Punchy", "Medium & Engaging", "Deep & Connecting"] },
    first_seven_words: { type: "string" },
    call_to_action_used: { type: "string" },
    hashtag_cluster_used: { type: "string" },
    emoji_signature: { type: "string" },
    metaphor_style_used: { type: "string" }
  },
  required: ["topic_overview", "business_trait_used", "framework_used", "tone_chosen", "format_structure", "target_length_category", "first_seven_words", "call_to_action_used", "hashtag_cluster_used", "emoji_signature", "metaphor_style_used"]
};

/**topic suggestion schema */
TOPIC_SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    suggestion: {
      type: "array",
      items: { type: "string" },
      minItems: 10,
      maxItems: 10
    }
  },
  required: ["suggestion"]
};

/**social post edit schema */
SOCIAL_POST_EDIT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The title of the Instagram post" },
    captions: { type: "string", description: "The main caption content for the Instagram post, including line breaks using \\n" }
  },
  required: ["title", "captions"]
};

/**seo blog edit schema */
// SEO_BLOG_EDIT_SCHEMA = {
//   type: "object",
//   properties: {
//     seo_blog: {
//       type: "object",
//       properties: {
//         title: { type: "string", description: "The title of the SEO blog" },
//         blog_text: { type: "string", description: "The full text content of the SEO blog. Use \\n for line breaks, and ensure that each heading is followed by a double line break (\\n\\n) for proper formatting." }
//       },
//       required: ["title", "blog_text"],
//     }
//   },
//   required: ["seo_blog"],
// }

SEO_BLOG_EDIT_SCHEMA = {
  type: "object",
  properties: {
    seo_blog: {
      type: "object",
      properties: {
        title: { type: "string", description: "The title of the SEO blog" },
        meta_description: { type: "string", description: "The meta description of the SEO blog" },
        blog_text: {
          type: "string",
          description: "The full body content of the SEO blog. Use \\n for line breaks, and ensure each heading is followed by a double line break (\\n\\n) for proper formatting."
        },
        generated_json: {
          type: "object",
          properties: {
            title: { type: "string", description: "Generated blog title suggestion" },
            meta_description: { type: "string", description: "Generated meta description suggestion" },
            image_alt_text: { type: "string", description: "Suggested image alt text for SEO" },
            suggested_url_slug: { type: "string", description: "SEO-friendly URL slug suggestion" },
            target_keywords: { type: "array", description: "List of target keywords for SEO", items: { type: "string" } }
          },
          required: ["title", "meta_description", "image_alt_text", "suggested_url_slug", "target_keywords"]
        }
      },
      required: ["title", "meta_description", "blog_text", "generated_json"],
    }
  },
  required: ["seo_blog"],
};


/**poll edit schema */
POLLS_EDIT_SCHEMA = {
  type: "object",
  properties: {
    poll: {
      type: "object",
      properties: {
        question: { 'type': "string", "description": "The main poll question, must not include hashtags" },
        options: {
          type: "array",
          items: { type: "string" },
          minItems: 4,
          maxItems: 4,
          description: "Exactly 4 meaningful, non-empty options unrelated to business industry"
        },
        hashtags: {
          type: "array",
          items: { type: "string" },
          minItems: 3,
          maxItems: 3,
          description: "Array of 3 hashtags, each containing minimum 3 or maximum 4 words"

        }
      },
      required: ["question", "options", "hashtags"]
    }
  },
  required: ["poll"]
}

/**email edit schema */
EMAIL_EDIT_SCHEMA = {
  type: "object",
  properties: {
    email: {
      type: "object",
      properties: {
        email_heading: { "type": "string", "description": "Main heading of the email" },
        subject: { "type": "string", "description": "Subject line of the email" },
        body: { "type": "string", "description": "Email body using <br> for line breaks. Should start with a casual greeting content with 2 to 3 complete sentences" },
        bullet_points: {
          type: "array",
          items: {
            anyOf: [
              {
                type: "object",
                required: ["heading1", "paragraph1"],
                properties: {
                  heading1: { type: "string", description: "Heading for first bullet point" },
                  paragraph1: { type: "string", description: "Paragraph for heading1, 2 to 3 lines" }
                }
              },
              {
                type: "object",
                required: ["heading2", "paragraph2"],
                properties: {
                  heading2: { type: "string", description: "Heading for second bullet point" },
                  paragraph2: { type: "string", description: "Paragraph for heading2, 2 to 3 lines" }
                }
              },
              {
                type: "object",
                required: ["heading3", "paragraph3"],
                properties: {
                  heading3: { type: "string", description: "Heading for third bullet point" },
                  paragraph3: { type: "string", description: "Paragraph for heading3, 2 to 3 lines" }
                }
              }
            ]
          }
        },
        email_closing_paragraph: { "type": "string", "description": "Final paragraph with 2 lines to close the email" },
        email_ending_signature: { "type": "string", "description": "Signature line, typically a name or brand" },
        cta_text: { "type": "string", "description": "Call-to-action text with 2 to 3 words" },
        cta_text_new: { "type": "string", "description": "Fixed CTA tag with value 'Quick Question'" }
      },
      required: ["email_heading", "subject", "body", "bullet_points", "email_closing_paragraph", "email_ending_signature", "cta_text", "cta_text_new"]
    }
  },
  required: ["email"]
}

/**other page prompt */
OTHER_PAGE_PROMPT = `From the given list of URLs, extract only those that are related to the following business-relevant page types:

- About  
- Services  
- Products  
- Menu  
- Events  
- Testimonials  
- Reviews  
- FAQs  

Only include URLs that:
- Likely provide useful information about the business  
- Are not links to downloadable files (e.g., .pdf, .doc, .zip, etc.)
- Are the **most suitable and relevant** link for each page type

If multiple URLs match the same page type, **select only one best link** that represents that page type. Do not include multiple links for the same page type.

Use the following input array:
{urls}
`;
/**format schema */
OTHER_LINKS_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      minItems: 1,
      description: "List of business-relevant URLs categorized by unique page types. Only one most suitable URL should be included per page type.",
      items: {
        type: "object",
        properties: {
          page_type: {
            type: "string",
            enum: [
              "About",
              "Services",
              "Products",
              "Menu",
              "Events",
              "Testimonials",
              "Reviews",
              "FAQs"
            ],
            description: "The page type this URL represents. Only one URL should be returned for each page type."
          },
          link: {
            type: "string",
            description: "The single most relevant and valid URL for the specified page type. Must not point to a downloadable file (e.g., .pdf, .doc)."
          }
        },
        required: ["page_type", "link"]
      }
    }
  },
  required: ["urls"]
};
/**other pages crawl prompt */
OTHER_PAGE_CRAWL_PROMPT = `You are a data extraction assistant. Your task is to extract key business details from the provided webpage content.

Instructions:
- Thoroughly analyze the page content.
- Extract and summarize the business-relevant details specific to the given "{page_type}".
- The output must be in valid JSON format.
- Do NOT wrap the output in backticks or code blocks.
- Ensure the output text is plain and human-readable.
- If any listing points are detected, return them as bullet points in plain text.

Input:
PageType: {page_type}

Page Data:
'''
{paragraphs}
'''
`;
/**schema for crawl other page content data */
SINGLE_PAGE_EXTRACTION_SCHEMA_TEMPLATE = (pageType) => ({
  type: "object",
  properties: {
    [pageType]: {
      type: "string",
      description: `Plain and structured explanation of the ${pageType} page content. If no relevant text is found, leave it as an empty string.`
    }
  },
  required: [pageType],
});

/**Marketing email */
MARKETING_EMAIL_PROMPT_FOR_GEMINI = `You are a creative marketing strategist.

Use the provided business data:
{business_data}

Analyze the business in-depth, focusing on key insights such as:
- Location and local culture
- Business model and industry
- Target audience and demographic trends
- Community and ecosystem advantages

Then, research additional insights about the business's local area online to understand its cultural vibe, economic landscape, and lifestyle patterns.

Based on your research and analysis, generate 3 types of marketing content tailored to resonate with the target audience and community:

1. **Instagram Caption**: Make it relatable and catchy. Use playful, local-friendly language that still emphasizes business growth. Keep it culturally relevant.
2. **Email Copy**: Write a short, impactful email. Start with a casual greeting (no names). Blend lifestyle and business benefits, and include a warm, personal-feeling CTA. Use <br> tags for line breaks.
3. **Display Ad Copy**: Write something short, bold, and fun. Focus on local culture + business value. Include a snappy, action-oriented CTA.

Finally, explain the **rationale** behind your choices, including your understanding of the target audience and the overall creative direction.
`;

/**marketing email schema */
MARKETING_EMAIL_SCHEMA = {
  "type": "object",
  "properties": {
    "instagram_caption": {
      "type": "string",
      "description": "A culturally aware, relatable Instagram caption with a professional yet playful tone"
    },
    "email_copy": {
      "type": "object",
      "properties": {
        "subject": {
          "type": "string",
          "description": "Email subject line with a creative, benefit-driven hook"
        },
        "body": {
          "type": "string",
          "description": "Email body using <br> for line breaks. Should start with a casual greeting and end with a CTA"
        }
      },
      "required": ["subject", "body"]
    },
    "display_ad_copy": {
      "type": "string",
      "description": "Short, bold ad copy with a fun and actionable local hook"
    },
    "rationale": {
      "type": "string",
      "description": "Brief explanation of the creative strategy, emotional triggers, and target audience alignment"
    }
  },
  "required": ["instagram_caption", "email_copy", "display_ad_copy", "rationale"]
}

/**other page links crawl  prompt */
OTHER_PAGE_LINKS_CRAWL_PROMPT = `From the given list of URLs, extract the ones that potentially provide relevant information about the business. 

Ensure the following:
- Each selected URL must point to a valid webpage (not a downloadable file like PDF, DOC, ZIP, etc.).
- Only include the most relevant and suitable URL for each page type. 
- Do not include multiple URLs for the same page type — ensure each page type appears only once.

Use the following input array:
{urls}
`;
/**format schema */
OTHER_PAGES_LINKS_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      minItems: 1,
      description: "List of business-relevant URLs categorized by unique page type. Only one most relevant URL should be included per page type.",
      items: {
        type: "object",
        properties: {
          page_type: {
            type: "string",
            description: "The type of page the link refers to. Only one entry per page type should be included in the list."
          },
          link: {
            type: "string",
            description: "The most relevant valid URL for the specified page type. Should not point to a file (e.g., .pdf, .doc, .zip, etc.)."
          }
        },
        required: ["page_type", "link"]
      }
    }
  },
  required: ["urls"]
};

/**suggestion campaign prompt */
SUGGESTION_CAMPAIGN_PROMPT = `
Your Goal:
Your goal is to act as a world-class social media strategist and market analyst. You will generate exactly 10 distinct, strategic, and timely social media post ideas for a business. Each idea must be a conversation starter designed to drive meaningful engagement and be grounded in a clear strategic rationale.

Core Mandate: From Ideas to Opportunities 
Do not provide generic ideas. Your task is to synthesize all the provided data and your own real-time research to find unique opportunities for the business to connect with its community, highlight its value, and stand out from its competitors. Each idea must be suitable for direct caption expansion.

BusinessData:
{BUSINESS_DATA}

Previous10Topics:
{PREVIOUS_TOPICS}

Inputs:
● {BusinessData}: A detailed profile of the business, including its name, city, brand voice, and key products/services.
● {Previous10Topics}: A list of the last 10 social media post topics to ensure freshness and avoid repetition.
● {CompetitorData}: (Optional) A brief analysis of recent posts from 1-2 key local competitors.

Part 1: The Strategic Blueprint (Chain-of-Thought)
Before generating the final output, you must document your reasoning process.

Step 1: Synthesize the Brand's Identity & Current State
● Analyze the Business: Based on {BusinessData}, briefly summarize the business's core offering.
● Tone Calibration: Match the brand voice in each idea (e.g., playful, professional, sincere). If unclear, default to engaging but respectful.
● Analyze Past Content: Based on {Previous10Topics}, identify any patterns or content gaps.
● Analyze the Market: Perform a web search for "current trends in the {BusinessData.BusinessCategory} industry." If {CompetitorData} is provided, compare topic overlap and post formats. Identify one white space—a type of post or tone this business could use to differentiate.

Step 2: Perform Tiered Hyper-Local Research
● Action: Perform a tiered search to find timely hooks, prioritizing in this order: Hyper-Local > Regional > National.
● Finding: Identify 2-3 specific, relevant events, holidays, or trends that can be used as timely hooks for the post ideas.

Step 3: Strategize a Balanced Mix of Content Ideas
● Goal: Generate exactly 10 ideas, ensuring no more than 3 belong to the same strategic category.
● Strategic Categories:
  1. Community Connection: An idea that uses a local event or trend from your research.
  2. Product/Service Spotlight: An idea that highlights a key offering in a new or interesting way.
  3. Educational/Value-Add: An idea that teaches the audience something useful or debunks a common myth.
  4. Behind-the-Scenes: An idea that humanizes the brand by showing the team or the process.
  5. Engaging Question/Poll: An idea that directly asks for the audience's opinion or experience.
  6. Fun/Lighthearted: A safe, brand-appropriate joke, riddle, or fun fact.

● Content Format Variety: The 10 ideas must include at least one that works well as a Reel, one that could be a poll, and one that would be effective as a carousel.

Part 2: Final Output - 10 Strategic Post Ideas
After completing your blueprint, provide the 10 post ideas below this exact header. Each idea must be 15 words or less. Each rationale must explain the strategic purpose (why this post will drive engagement, build trust, or showcase the brand) in under 25 words.

Example Format:
Idea: Ask our followers to share their favorite memory at Balboa Park. (Poll)
Why it works: Connects our brand to a beloved local landmark. Encourages nostalgic, positive comments and boosts engagement through the poll sticker.
1. Idea: [Your First Idea] [Format Suggestion, e.g., (Reel)]
  Why it works: [Your Strategic Rationale]
2. Idea: [Your Second Idea] [Format Suggestion, e.g., (Carousel)]
  Why it works: [Your Strategic Rationale]
3. Idea: [Your Third Idea] [Format Suggestion, e.g., (Poll)]
  Why it works: [Your Strategic Rationale]
4. Idea: [Your Fourth Idea]
  Why it works: [Your Strategic Rationale]
5. Idea: [Your Fifth Idea]
  Why it works: [Your Strategic Rationale]
6. Idea: [Your Sixth Idea]
  Why it works: [Your Strategic Rationale]
7. Idea: [Your Seventh Idea]
  Why it works: [Your Strategic Rationale]
8. Idea: [Your Eighth Idea]
  Why it works: [Your Strategic Rationale]
9. Idea: [Your Ninth Idea]
  Why it works: [Your Strategic Rationale]
10. Idea: [Your Tenth Idea]
  Why it works: [Your Strategic Rationale]
`;

SUGGETION_CAMPAIGN_FORMAT = `Return only the JSON with the following object schema:

Rules:
- Do NOT include any placeholder text such as [Name], [City], [Product], or [Business Name].
- Always replace with realistic, specific, but non-placeholder text based on provided data or create a plausible fictional detail.
- Never output brackets [] in the final ideas or rationale.
- Ensure only one "idea" contains "(Poll)", only one contains "(Reel)", and only one contains "(Carousel)".
- No other ideas may have these format labels.

\`\`\`json
{
  "suggestion": [
    {
      "idea": "[Your First Idea][Format Suggestion, e.g., (Reel)]",
      "why_it_works": "Rationale for why it works"
    },
    {
      "idea": "[Your Second Idea][Format Suggestion, e.g., (Carousel)]",
      "why_it_works": "Rationale for why it works"
    },
    {
      "idea": "[Your Third Idea][Format Suggestion, e.g., (Poll)]",
      "why_it_works": "Rationale for why it works"
    }
    // Continue until there are exactly 10 objects and make sure do not include any placeholder text
  ]
  
}
\`\`\``;

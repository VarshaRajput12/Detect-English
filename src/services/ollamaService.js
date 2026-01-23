// OpenRouter API Service
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Get API key from environment variable or use empty string
// Get your free API key from: https://openrouter.ai/keys
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || "";
const MODEL_NAME = "google/gemini-2.0-flash-exp:free"; // Free model from OpenRouter

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // Minimum 2 seconds between requests

// Check if API key is configured
const isApiConfigured = () => {
  if (!OPENROUTER_API_KEY) {
    console.warn(
      "OpenRouter API key not configured. Get one free at: https://openrouter.ai/keys",
    );
    return false;
  }
  return true;
};

// Helper to wait between requests
const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`⏱️ Rate limit: waiting ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
};

/**
 * Generate filler phrases based on conversation context
 */
export async function generateFillerPhrase(userSpeechChunk, questionContext) {
  if (!isApiConfigured()) {
    // Return a generic filler phrase when API is not configured
    const genericFillers = [
      "I see, please continue.",
      "That's interesting, tell me more.",
      "Good point, go on.",
      "I understand, please elaborate.",
      "Interesting perspective, continue.",
    ];
    return genericFillers[Math.floor(Math.random() * genericFillers.length)];
  }

  // Enforce rate limiting
  await enforceRateLimit();

  try {
    const prompt = `You are conducting an interview. The question asked was: "${questionContext}"

The interviewee just said: "${userSpeechChunk}"

Generate a SHORT, natural filler phrase (5-10 words) that:
1. Acknowledges what they said specifically
2. Shows you're actively listening
3. Encourages them to continue speaking

The filler MUST be contextually relevant to what they just said. Reference their specific point.

Examples for context:
- If they mention "AI helps with tasks" → "Interesting point about AI assistance, tell me more about those specific tasks"
- If they say "renewable energy is sustainable" → "That's a great observation about sustainability, please continue with that idea"
- If they mention "internet uses protocols" → "Good mention of protocols there, feel free to elaborate on how they work"

Now generate ONE contextual filler phrase for their response. Just the phrase, no quotes:`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "AI Interview Tool",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 50,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      // Try to read the error body
      let errorDetails = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorDetails += ` - ${errorData.error.message}`;
        } else {
          errorDetails += ` - ${JSON.stringify(errorData)}`;
        }
      } catch (e) {
        // Could not parse error body
      }

      console.warn(
        `OpenRouter API Error: ${errorDetails}. Using fallback response.`,
      );
      
      const genericFillers = [
        "I see, please continue.",
        "That's interesting, tell me more.",
        "Good point, go on.",
        "I understand, please elaborate.",
        "Interesting perspective, continue.",
      ];
      return genericFillers[Math.floor(Math.random() * genericFillers.length)];
    }

    const data = await response.json();
    let filler = data.choices[0].message.content
      .trim()
      .replace(/^["']|["']$/g, ""); // Remove quotes

    // Clean up the filler (remove any markdown, extra formatting)
    filler = filler.split("\n")[0]; // Take only first line
    filler = filler.replace(/[*_~`]/g, ""); // Remove markdown characters

    // Log the generated filler phrase with styling
    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #9333ea",
    );
    console.log(
      "%c🎯 FILLER PHRASE GENERATED",
      "color: #059669; font-weight: bold; font-size: 14px",
    );
    console.log("%c💬 Filler:", "color: #0ea5e9; font-weight: bold", filler);
    console.log(
      "%c📝 User said:",
      "color: #f59e0b; font-weight: bold",
      userSpeechChunk,
    );
    console.log(
      "%c❓ Question:",
      "color: #8b5cf6; font-weight: bold",
      questionContext,
    );
    console.log(
      "%c📊 Length:",
      "color: #06b6d4",
      filler.split(" ").length,
      "words",
    );
    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #9333ea",
    );

    return filler;
  } catch (error) {
    console.error("❌ Error generating filler phrase:", error);
    // Enhanced contextual fallback filler phrases
    const contextKeywords = userSpeechChunk.toLowerCase();
    let fallback;

    // Try to make fallback contextually relevant
    if (
      contextKeywords.includes("ai") ||
      contextKeywords.includes("artificial intelligence")
    ) {
      fallback =
        "That's an insightful point about AI, please continue explaining your thoughts on this";
    } else if (
      contextKeywords.includes("energy") ||
      contextKeywords.includes("renewable")
    ) {
      fallback =
        "Interesting perspective on energy, I'd like to hear more about that specific aspect";
    } else if (
      contextKeywords.includes("internet") ||
      contextKeywords.includes("network")
    ) {
      fallback =
        "Good explanation there, feel free to elaborate more on how that works";
    } else if (
      contextKeywords.includes("climate") ||
      contextKeywords.includes("environment")
    ) {
      fallback =
        "That's a valuable point about climate issues, please continue with your analysis";
    } else if (
      contextKeywords.includes("data") ||
      contextKeywords.includes("privacy")
    ) {
      fallback =
        "Great observation about data privacy, tell me more about your thinking here";
    } else {
      // Generic contextual fallbacks
      const genericFallbacks = [
        "That's a really insightful point you're making, please continue with your explanation",
        "I understand what you're saying there, feel free to elaborate further on that",
        "That makes a lot of sense, I'd love to hear more details about your perspective",
        "I see where you're coming from with that, go ahead and share more thoughts",
        "That's a valuable observation you've made, please tell me more about that aspect",
        "I appreciate your thoughtful answer there, continue explaining your reasoning please",
        "That's an excellent way to approach it, keep going with that line of thinking",
      ];
      fallback =
        genericFallbacks[Math.floor(Math.random() * genericFallbacks.length)];
    }

    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #dc2626",
    );
    console.log(
      "%c💬 FALLBACK FILLER (Contextual)",
      "color: #dc2626; font-weight: bold; font-size: 14px",
    );
    console.log("%c🔄 Filler:", "color: #0ea5e9; font-weight: bold", fallback);
    console.log(
      "%c📝 User said:",
      "color: #f59e0b; font-weight: bold",
      userSpeechChunk,
    );
    console.log(
      "%c❓ Question:",
      "color: #8b5cf6; font-weight: bold",
      questionContext,
    );
    console.log(
      "%c📊 Length:",
      "color: #06b6d4",
      fallback.split(" ").length,
      "words",
    );
    console.log(
      "%c⚠️ Reason: OpenRouter API error - using contextual fallback",
      "color: #ea580c",
    );
    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #dc2626",
    );
    return fallback;
  }
}

/**
 * Generate Q&A summary
 */
export async function generateQASummary(question, answer) {
  if (!isApiConfigured()) {
    // Return a basic summary when API is not configured
    return {
      summary: `Discussed: ${question.substring(0, 100)}...`,
      keyPoints: ["Response provided", "Further details shared"],
      clarity: "fair",
      completeness: "fair",
    };
  }

  try {
    const prompt = `Analyze this interview Q&A and provide a JSON response.

Question: ${question}
Answer: ${answer}

Provide a strict JSON response with this exact structure:
{
  "summary": "A concise 1-2 sentence summary of the answer",
  "keyPoints": ["point1", "point2"],
  "clarity": "good/fair/poor",
  "completeness": "good/fair/poor"
}

Respond with ONLY valid JSON, no other text.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "AI Interview Tool",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      let errorDetails = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorDetails += ` - ${errorData.error.message}`;
        } else {
          errorDetails += ` - ${JSON.stringify(errorData)}`;
        }
      } catch (e) {
        // Could not parse error body
      }
      throw new Error(`OpenRouter API error: ${errorDetails}`);
    }

    const data = await response.json();

    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #059669",
    );
    console.log(
      "%c📝 Q&A SUMMARY GENERATED",
      "color: #059669; font-weight: bold; font-size: 14px",
    );
    console.log(
      "%c🔍 Raw response:",
      "color: #8b5cf6",
      data.choices[0].message.content,
    );

    // Parse JSON from response
    try {
      const responseContent = data.choices[0].message.content;
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(
          "%c✅ Parsed summary:",
          "color: #16a34a; font-weight: bold",
          parsed,
        );
        console.log(
          "%c═══════════════════════════════════════════════════════════════════════════",
          "color: #059669",
        );
        return parsed;
      }
    } catch (e) {
      console.error(
        "%c❌ Error parsing JSON:",
        "color: #dc2626; font-weight: bold",
        e,
      );
    }

    // Fallback
    console.log(
      "%c⚠️ Using fallback Q&A summary",
      "color: #f59e0b; font-weight: bold",
    );
    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #f59e0b",
    );
    return {
      summary: answer.substring(0, 100) + "...",
      keyPoints: ["User provided an answer"],
      clarity: "fair",
      completeness: "fair",
    };
  } catch (error) {
    console.error("Error generating Q&A summary:", error);
    // Return fallback instead of throwing
    return {
      summary: answer.substring(0, 100) + "...",
      keyPoints: ["Response recorded (AI generation unavailable)"],
      clarity: "fair",
      completeness: "fair",
    };
  }
}

/**
 * Generate final summary and improvement plan
 */
export async function generateFinalSummary(allQAs, allSummaries = []) {
  if (!isApiConfigured()) {
    // Return a basic final summary when API is not configured
    return {
      overallPerformance:
        "The interview covered multiple topics with various responses provided.",
      strengths: [
        "Participated in the interview",
        "Provided responses to questions",
      ],
      areasForImprovement: ["API key needed for detailed AI analysis"],
      score: "N/A",
    };
  }

  try {
    const qaText = allQAs
      .map(
        (qa, idx) => `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`,
      )
      .join("\n\n");

    // Add summaries if available for better context
    const summaryText =
      allSummaries.length > 0
        ? "\n\nPrevious Q&A Summaries:\n" +
          allSummaries
            .map(
              (s, idx) =>
                `Q${idx + 1} Summary: ${s.summary} (Clarity: ${
                  s.clarity
                }, Completeness: ${s.completeness})`,
            )
            .join("\n")
        : "";

    const prompt = `Analyze this complete interview and provide a JSON response.

${qaText}${summaryText}

Provide a strict JSON response with this exact structure:
{
  "overallSummary": "2-3 sentence overall performance summary",
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "improvementPlan": {
    "shortTerm": ["action1", "action2"],
    "longTerm": ["action1", "action2"]
  },
  "overallScore": "excellent/good/fair/needs improvement"
}

Respond with ONLY valid JSON, no other text.`;

    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #16a34a",
    );
    console.log(
      "%c📊 GENERATING FINAL SUMMARY",
      "color: #16a34a; font-weight: bold; font-size: 14px",
    );
    console.log(
      "%c📝 Total Q&As:",
      "color: #0ea5e9; font-weight: bold",
      allQAs.length,
    );
    console.log(
      "%c📋 Summaries available:",
      "color: #f59e0b; font-weight: bold",
      allSummaries.length,
    );
    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #16a34a",
    );

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "AI Interview Tool",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      let errorDetails = `Status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
          errorDetails += ` - ${errorData.error.message}`;
        } else {
          errorDetails += ` - ${JSON.stringify(errorData)}`;
        }
      } catch (e) {
        // Could not parse error body
        errorDetails += ` (${response.statusText})`;
      }
      throw new Error(`OpenRouter API error: ${errorDetails}`);
    }

    const data = await response.json();

    console.log(
      "%c🔍 Raw OpenRouter Response:",
      "color: #8b5cf6; font-weight: bold",
      data.choices[0].message.content,
    );

    // Parse JSON from response
    try {
      const responseContent = data.choices[0].message.content;
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(
          "%c✅ Successfully parsed final summary:",
          "color: #16a34a; font-weight: bold",
          parsed,
        );
        console.log(
          "%c═══════════════════════════════════════════════════════════════════════════",
          "color: #16a34a",
        );
        return parsed;
      }
    } catch (e) {
      console.error(
        "%c❌ Error parsing JSON:",
        "color: #dc2626; font-weight: bold",
        e,
      );
      console.log(
        "%c═══════════════════════════════════════════════════════════════════════════",
        "color: #dc2626",
      );
    }

    // Fallback
    console.log(
      "%c⚠️ Using fallback final summary",
      "color: #f59e0b; font-weight: bold",
    );
    console.log(
      "%c═══════════════════════════════════════════════════════════════════════════",
      "color: #f59e0b",
    );
    return {
      overallSummary: "Interview completed successfully.",
      strengths: ["Participated in all questions", "Provided answers"],
      areasForImprovement: ["Continue practicing", "Expand knowledge"],
      improvementPlan: {
        shortTerm: ["Review answers", "Practice speaking"],
        longTerm: ["Study related topics", "Build confidence"],
      },
      overallScore: "good",
    };
  } catch (error) {
    console.error("Error generating final summary:", error);
    return {
      overallSummary: "Interview completed.",
      strengths: ["Completed all questions"],
      areasForImprovement: ["Continue learning"],
      improvementPlan: {
        shortTerm: ["Review performance"],
        longTerm: ["Keep practicing"],
      },
      overallScore: "fair",
    };
  }
}

/**
 * Check if OpenRouter API is accessible
 */
export async function checkOllamaConnection() {
  try {
    // For OpenRouter API, we'll just return true and let actual API calls handle errors
    // This prevents blocking the app startup with connection checks
    return true;
  } catch (error) {
    console.error("Error checking OpenRouter connection:", error);
    return true; // Return true to allow the app to load
  }
}

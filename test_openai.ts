
// Simple script to test OpenAI API Key + Model
const OPENAI_API_KEY = "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";

async function testOpenAI() {
    console.log("Testing OpenAI Key...");
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: "Hello!" }],
                max_tokens: 10
            }),
        });
        
        const data = await response.json();
        if (data.error) {
            console.error("❌ API Error:", JSON.stringify(data.error, null, 2));
        } else {
            console.log("✅ Success! Response:", data.choices[0].message.content);
        }
    } catch (e) {
        console.error("❌ Network/Fetch Error:", e);
    }
}

testOpenAI();


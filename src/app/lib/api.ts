const BASE_URL = "http://10.120.101.22:8000";

export const sendChatMessage = async (message: string) => {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: message, // ⚠️ MUST match FastAPI
    }),
  });

  if (!response.ok) {
    throw new Error("Backend not reachable");
  }

  return response.json();
};
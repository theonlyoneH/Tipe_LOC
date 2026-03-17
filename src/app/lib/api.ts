const BASE_URL = import.meta.env.VITE_API_URL;

export const sendChatMessage = async (message: string) => {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: message, // must match FastAPI
    }),
  });

  if (!response.ok) {
    throw new Error("Backend not reachable");
  }

  return response.json();
};
const BASE_URL = import.meta.env.VITE_API_URL;

export const fetchTradeSignals = async () => {
  try {
    const res = await fetch(
      `${BASE_URL}/trade-news`, 
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Failed to fetch");

    return await res.json();
  } catch (error) {
    console.error("Trade signal fetch error:", error);
    return [];
  }
};
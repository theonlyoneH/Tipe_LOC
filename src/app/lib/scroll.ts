const BASE_URL = "http://10.120.113.124:8000";


export const fetchTradeSignals = async () => {
  try {
    const res = await fetch(
      `${BASE_URL}/trade_signals_output.json`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("Failed to fetch");

    return await res.json();
  } catch (error) {
    console.error("Trade signal fetch error:", error);
    return [];
  }
};
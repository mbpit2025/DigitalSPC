// data-collector/websocket/ws-emitter.js

async function pushLatestData(payload) {
  try {
    const res = await fetch(`http://localhost:3000/api/realtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latestData: payload }),
    });

    const result = await res.json();
    console.log("[DUMMY -> API] Response:", result);
  } catch (err) {
    console.error("[DUMMY -> API] Error:", err.message);
  }
}

module.exports = { pushLatestData };

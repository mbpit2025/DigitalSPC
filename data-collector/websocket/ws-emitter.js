// data-collector/websocket/ws-emitter.js

async function pushLatestData(payload) {
  try {
    const res = await fetch(`http://localhost:3000/api/realtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latestData: payload }),
    });

    const result = await res.json();
    console.log("[API POST] Response:", result);
  } catch (err) {
    console.error("[API POST] Error:", err.message);
  }
}

module.exports = { pushLatestData };

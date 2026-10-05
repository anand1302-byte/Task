const END = Date.parse(process.env.END_UTC);
const START = Date.parse(process.env.START_UTC);
const now = Date.now();

if (now < START || now > END) {
  console.log(JSON.stringify({ type: "inactive", ts: new Date().toISOString() }));
  process.exit(0);
}

const url = "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=40";
const response = await fetch(url, { headers: { "user-agent": "btc-paper-tracker" } });
if (!response.ok) throw new Error("Binance HTTP " + response.status);

const raw = await response.json();
const rows = raw.map(x => ({
  t: +x[0], o: +x[1], h: +x[2], l: +x[3], c: +x[4], v: +x[5], end: +x[6]
}));
const completed = rows.filter(x => x.end <= Date.now());

function ema(a, n) {
  const q = 2 / (n + 1);
  let e = a[0];
  for (let i = 1; i < a.length; i++) e = a[i] * q + e * (1 - q);
  return e;
}

function rsi(a, n = 7) {
  if (a.length < n + 1) return 50;
  let g = 0, l = 0;
  for (let i = a.length - n; i < a.length; i++) {
    const d = a[i] - a[i - 1];
    if (d > 0) g += d;
    else l -= d;
  }
  if (l === 0) return 100;
  const rs = (g / n) / (l / n);
  return 100 - 100 / (1 + rs);
}

function signal(arr) {
  const c = arr.map(x => x.c);
  if (c.length < 12) return { side: "NO_TRADE", score: 0, confidence: 50 };

  const last = c.at(-1);
  const r1 = last / c.at(-2) - 1;
  const r3 = last / c.at(-4) - 1;
  const r5 = last / c.at(-6) - 1;
  const e5 = ema(c.slice(-10), 5);
  const e10 = ema(c.slice(-15), 10);
  const R = rsi(c, 7);

  let s = 0;
  if (r1 > 0.00015) s++; else if (r1 < -0.00015) s--;
  if (r3 > 0.00030) s++; else if (r3 < -0.00030) s--;
  if (r5 > 0.00045) s++; else if (r5 < -0.00045) s--;
  if (e5 > e10 * 1.00005) s++; else if (e5 < e10 * 0.99995) s--;
  if (R > 56 && R < 78) s++; else if (R < 44 && R > 22) s--;

  const side = s >= 3 ? "BUY_CALL" : s <= -3 ? "BUY_PUT" : "NO_TRADE";

  return {
    side,
    score: s,
    confidence: side === "NO_TRADE" ? 50 : Math.min(70, 52 + Math.abs(s) * 4),
    r1: +(r1 * 100).toFixed(3),
    r3: +(r3 * 100).toFixed(3),
    r5: +(r5 * 100).toFixed(3),
    rsi: +R.toFixed(1),
    ema5: +e5.toFixed(2),
    ema10: +e10.toFixed(2),
    price: +last.toFixed(2),
    signalTs: new Date(arr.at(-1).end).toISOString()
  };
}

const current = signal(completed);
const previous = signal(completed.slice(0, -5));

let result = "NO_TRADE";
if (previous.side !== "NO_TRADE") {
  const entry = previous.price;
  const exit = completed.at(-1).c;
  result = previous.side === "BUY_CALL"
    ? (exit > entry ? "WIN" : "LOSS")
    : (exit < entry ? "WIN" : "LOSS");
}

console.log(JSON.stringify({
  type: "btc_paper_5m",
  runTs: new Date().toISOString(),
  current,
  previous: {
    ...previous,
    exitPrice: +completed.at(-1).c.toFixed(2),
    result
  }
}));

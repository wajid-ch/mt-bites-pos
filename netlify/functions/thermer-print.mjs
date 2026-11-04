// Netlify Serverless Function: Serves JSON_FORCE_OBJECT receipt payload
// for Thermer / Bluetooth Print app on both iOS (`bprint://`) and Android (`my.bluetoothprint.scheme://`).

export default async (req) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate'
  };

  try {
    const url = new URL(req.url);
    const encoded = url.searchParams.get('d');
    if (!encoded) {
      return new Response(
        JSON.stringify({ '0': { type: 0, content: 'MT BITES POS - Ready', bold: 1, align: 1, format: 0 } }),
        { status: 200, headers }
      );
    }

    // Decode base64url compact payload
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
    const jsonStr = Buffer.from(base64 + pad, 'base64').toString('utf-8');
    const data = JSON.parse(jsonStr);

    // If the payload is a JSON_FORCE_OBJECT map or array of print entries,
    // pad keys with leading zeros ("000", "001", "002") so iOS NSDictionary / Swift Dictionary
    // sorted-key iteration NEVER scrambles line "10" before line "2"!
    const entries = Array.isArray(data)
      ? data
      : Object.keys(data)
          .sort((a, b) => Number(a) - Number(b))
          .map(k => data[k]);

    const forcedObj = {};
    entries.forEach((entry, idx) => {
      const paddedKey = String(idx).padStart(3, '0');
      forcedObj[paddedKey] = entry;
    });
    return new Response(JSON.stringify(forcedObj), { status: 200, headers });
  } catch (err) {
    return new Response(
      JSON.stringify({
        '0': { type: 0, content: 'MT BITES POS', bold: 1, align: 1, format: 2 },
        '1': { type: 0, content: `Print Error: ${err.message}`, bold: 0, align: 0, format: 0 }
      }),
      { status: 200, headers }
    );
  }
};

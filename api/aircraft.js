export default async function handler(req, res) {
  try {
    // Minsk area ~250 nm radius (covers Belarus + nearby)
    const url = 'https://api.adsb.lol/v2/lat/53.9/lon/27.6/dist/250';
    const r = await fetch(url, {
      headers: { Accept: 'application/json' }
    });

    if (!r.ok) {
      res.status(r.status).json({ error: 'Upstream returned ' + r.status });
      return;
    }

    const data = await r.json();
    const ac = Array.isArray(data.ac) ? data.ac : [];

    // Normalize to a compact OpenSky-like shape for the frontend
    const states = ac
      .filter(a => a.lat != null && a.lon != null)
      .map(a => {
        const alt = a.alt_baro != null && a.alt_baro !== 'ground' ? a.alt_baro : null;
        const onGround = a.alt_baro === 'ground' || (alt != null && alt < 50);
        const vel = a.gs != null ? a.gs * 0.514444 : null; // knots → m/s
        return [
          a.hex || null,                    // 0 icao24
          (a.flight || '').trim() || null,  // 1 callsign
          a.r || null,                      // 2 registration / country proxy
          null,                             // 3 time_position
          a.seen != null ? Math.floor(Date.now() / 1000 - a.seen) : null, // 4 last_contact approx
          a.lon,                            // 5 lon
          a.lat,                            // 6 lat
          alt != null ? alt * 0.3048 : null,// 7 baro altitude ft → m
          onGround,                         // 8 on_ground
          vel,                              // 9 velocity m/s
          a.track != null ? a.track : a.true_heading, // 10 true_track
          a.baro_rate != null ? a.baro_rate * 0.00508 : null, // 11 vertical_rate ft/min → m/s
          a.t || null,                      // 12 type (extra)
          a.category || null                // 13 category
        ];
      });

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      time: Math.floor(Date.now() / 1000),
      states,
      source: 'adsb.lol',
      count: states.length
    });
  } catch (e) {
    res.status(502).json({ error: 'Источник данных недоступен', message: String(e.message || e) });
  }
}

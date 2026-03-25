export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // ✅ MANIFEST
    if (path.endsWith('/manifest.json')) {
      return res.status(200).json({
        id: "nxb.vixsrc",
        version: "1.0.0",
        name: "NXB VixSrc",
        description: "VixSrc streaming addon",
        resources: ["stream"],
        types: ["movie", "series"],
        idPrefixes: ["tt"]
      });
    }

    // ✅ STREAM HANDLER (only runs if matched)
    if (path.includes('/stream/')) {
      const match = path.match(/\/stream\/(movie|series)\/(.+)\.json/);

      if (!match) {
        return res.json({ streams: [] });
      }

      const type = match[1];
      const id = match[2];

      const tmdb = await getTMDB(id);
      if (!tmdb) return res.json({ streams: [] });

      let targetUrl;

      if (type === "movie") {
        targetUrl = `https://vixsrc.to/movie/${tmdb.id}`;
      } else {
        const idParts = id.split(':');
        const season = idParts[1];
        const episode = idParts[2];

        if (!season || !episode) {
          return res.json({ streams: [] });
        }

        targetUrl = `https://vixsrc.to/tv/${tmdb.id}/${season}/${episode}`;
      }

      const stream = await extractVix(targetUrl);

      if (!stream) return res.json({ streams: [] });

      return res.json({
        streams: [
          {
            title: "VixSrc HLS",
            url: stream
          }
        ]
      });
    }

    // ✅ fallback (now works again)
    return res.status(200).send("Addon running");

  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
}

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

    // ✅ STREAM HANDLER
    if (path.includes('/stream/')) {
      const parts = path.split('/');
      const type = parts[3];
      const id = parts[4];

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

    // fallback
    res.status(200).send("Addon running");

  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
}

// 🔥 TMDB
async function getTMDB(imdb) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/find/${imdb}?api_key=488eb36776275b8ae18600751059fb49&external_source=imdb_id`);
    const data = await res.json();

    if (data.movie_results?.length) {
      return { id: data.movie_results[0].id };
    }

    if (data.tv_results?.length) {
      return { id: data.tv_results[0].id };
    }

    return null;
  } catch {
    return null;
  }
}

// 🔥 VixSrc extractor
async function extractVix(url) {
  try {
    const res = await fetch(url, {
      headers: { Referer: url }
    });

    const html = await res.text();

    const token = html.match(/['"]token['"]: ?['"](.*?)['"]/)?.[1];
    const expires = html.match(/['"]expires['"]: ?['"](.*?)['"]/)?.[1];
    const base = html.match(/url: ?['"](.*?)['"]/)?.[1];

    if (!token || !expires || !base) return null;

    const u = new URL(base);
    const playlist = `${u.origin}${u.pathname}.m3u8?${u.searchParams}`;

    return `${playlist}&token=${token}&expires=${expires}&h=1`;

  } catch {
    return null;
  }
}

import { addonBuilder } from 'stremio-addon-sdk';

const manifest = {
  id: "nxb.vixsrc",
  version: "1.0.0",
  name: "NXB VixSrc",
  description: "VixSrc streaming addon",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"]
};

const builder = new addonBuilder(manifest);

// 🔥 Convert IMDB → TMDB
async function getTMDB(imdb) {
  try {
    const res = await fetch(`https://api.themoviedb.org/3/find/${imdb}?api_key=488eb36776275b8ae18600751059fb49&external_source=imdb_id`);
    const data = await res.json();

    if (data.movie_results?.length) {
      return { id: data.movie_results[0].id, type: "movie" };
    }

    if (data.tv_results?.length) {
      return { id: data.tv_results[0].id, type: "tv" };
    }

    return null;
  } catch {
    return null;
  }
}

// 🔥 Extract VixSrc stream
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

// 🎬 STREAM HANDLER
builder.defineStreamHandler(async ({ type, id }) => {
  try {
    const tmdb = await getTMDB(id);
    if (!tmdb) return { streams: [] };

    let url;

    if (type === "movie") {
      url = `https://vixsrc.to/movie/${tmdb.id}`;
    } else {
      const parts = id.split(":");
      const season = parts[1];
      const episode = parts[2];

      if (!season || !episode) return { streams: [] };

      url = `https://vixsrc.to/tv/${tmdb.id}/${season}/${episode}`;
    }

    const stream = await extractVix(url);
    if (!stream) return { streams: [] };

    return {
      streams: [
        {
          title: "VixSrc HLS",
          url: stream
        }
      ]
    };

  } catch {
    return { streams: [] };
  }
});

const addonInterface = builder.getInterface();

// ✅ FIXED HANDLER (NO serveHTTP, NO CRASH)
export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const url = req.url;

    // 👉 MANIFEST
    if (url.endsWith('/manifest.json')) {
      return res.status(200).json(manifest);
    }

    // 👉 STREAM HANDLER (Stremio calls this)
    return addonInterface(req, res);

  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
}

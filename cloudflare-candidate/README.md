# RecordNote Location release candidate

Exact live Cloudflare baselines are in `../cloudflare-baseline`. This candidate is not deployed and cannot be promoted until syntax checks, source comparison and rollback checks pass. The Web no longer calls any location provider in start/stop/playback/list. Users explicitly opt in to Geoapify (fresh per-user consent) and click to geocode; results persist in per-account local storage. Old NLSC route retires to HTTP 410 after simultaneous Web/API deployment. Cloudflare bindings/secrets/D1/R2/old audio remain unchanged.

# NormaTEP

Static CSV-driven TMS-EEG normative reference explorer for inspecting feature statistics and computing z-scores plus Mahalanobis distance. The UI is self-contained, no longer depends on CDN-hosted runtime libraries, and is now structured around the manuscript's three workflows: normative exploration, univariate benchmarking, and multivariate benchmarking.

## Project structure

- `index.html`: app shell and section layout
- `public/styles/app.css`: page styling and component presentation
- `public/scripts/app.js`: local CSV parsing, manuscript-aligned exploration filters, report export, calculator state, and statistical helpers
- `public/stats_data.csv`: normative feature statistics
- `public/covariance_data.csv`: covariance matrix used for D2

## Local preview

The app loads CSV files at runtime, so it should be served over HTTP instead of opened directly from the filesystem.

```powershell
python -m http.server 8000
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).

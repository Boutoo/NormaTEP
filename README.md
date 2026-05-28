# NormaTEP

NormaTEP is an open-source, browser-based explorer for normative TMS-EEG reference data. It is designed to help researchers inspect feature-level norms, benchmark single-subject observations, and combine selected features into multivariate atypicality estimates.

The current release focuses on Left-M1 single-pulse TMS-EEG and includes 968 normative features. The application is static, CSV-driven, and runs entirely in the browser: there is no backend service, no account system, and no uploaded participant data.

**Hosted app:** [https://boutoo.github.io/NormaTEP/](https://boutoo.github.io/NormaTEP/)

## What NormaTEP Does

NormaTEP currently supports three integrated workflows:

1. **Normative exploration**
  Browse the normative distribution of each available feature by measure, time window, frequency band, and spatial cluster. The table exposes population means, standard deviations, reliability metrics, confidence intervals, and measurement-error estimates.
2. **Univariate benchmarking**
  Enter an observed single-subject value for a selected feature and convert it to a norm-referenced Z-score, with visual flags for values outside the expected interval.
3. **Multivariate benchmarking**
  Assemble a custom feature vector and compute squared Mahalanobis distance (`D^2`) using the bundled normative covariance matrix. The result is evaluated against a Chi-squared distribution to provide an integrated atypicality estimate and p-value.

Structured outputs can be exported for downstream analysis, documentation, or reproducibility checks.

## Current Data Scope

The bundled reference data currently covers:

- Left-M1 single-pulse TMS-EEG
- 968 feature definitions
- Feature identifiers: measure, time window, frequency band, and spatial cluster
- Normative summary statistics: mean, standard deviation, confidence intervals, coefficient of variation, intraclass correlation, and standard error of measurement
- Covariance data for multivariate `D^2` calculations

NormaTEP is a research-support tool. It is not a diagnostic system and should not be used as a standalone basis for clinical decisions.

## Community-Driven Expansion

NormaTEP is intended to grow as a community-maintained open-source resource. Expansion will be guided by requests, issues, and reviewed submissions on this GitHub repository, not through the deployed website.

Use GitHub Issues or Pull Requests to:

- request support for additional TMS targets, protocols, cohorts, populations, or feature families;
- submit new normative datasets;
- propose new benchmarking, visualization, filtering, or export workflows;
- report bugs, inconsistencies, or unclear behavior;
- improve documentation, terminology, validation notes, or scientific interpretation guidance.

## Data Submission Guidance

Dataset submissions should include enough information for scientific and technical review. When proposing new data, please provide:

- protocol and acquisition details;
  - neuronavigation, noise-masking and real-time monitoring of the signals are required.
- cohort description and inclusion/exclusion criteria;
- preprocessing assumptions and software versions where relevant;
- citations, preprints, manuscripts, or validation notes;
- known limitations or recommended-use boundaries.

## Repository Structure

- `index.html`: application shell and page layout
- `public/styles/app.css`: visual styling and component presentation
- `public/scripts/app.js`: CSV parsing, filters, calculator state, report export, and statistical helpers
- `public/stats_data.csv`: normative feature statistics
- `public/covariance_data.csv`: covariance matrix used for `D^2`
- `public/figures/`: figures for manuscripts, documentation, or repository materials

## Local Development

The app loads CSV files at runtime, so it should be served over HTTP rather than opened directly from the filesystem.

```powershell
python -m http.server 8000
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000).

No build step is required for the current static version.

## Design Principles

NormaTEP should remain:

- transparent: all bundled data and calculations should be inspectable;
- reproducible: outputs should be traceable to documented feature definitions and reference files;
- lightweight: the app should stay easy to host, mirror, and run locally;
- privacy-preserving: subject values entered by users should remain in the browser;
- community-extensible: new functionality should be reviewed through repository issues and pull requests.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.

# CodeSpecWeave project page

Static HTML, CSS, and JavaScript with local fonts, icons, and a method figure.
No build step or backend is required.

[Read the paper on arXiv](https://arxiv.org/abs/2610.40256).
The full BibTeX citation is available on the page and in [citation.bib](citation.bib).

Run from this directory to preview:

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

Open <http://localhost:8766>. Use HTTP to load local fonts reliably.

For GitHub Pages, publish the repository root. Local previews are excluded by
`.gitignore`.

Inter and Space Grotesk fonts retain their OFL licenses in `assets/fonts/`.
Model icons are from [LobeHub](https://github.com/lobehub/lobe-icons), version
1.95.1, with the MIT notice in `assets/model-icons/LICENSE`.

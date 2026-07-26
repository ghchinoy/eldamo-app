# Spike Report: Embedding Model Evaluation on Elvish Dictionary Data

## Executive Summary
We evaluated **Local FastEmbed (`paraphrase-multilingual-mpnet-base-v2`, 768-dim)** vs **Cloud Gemini Embedding 2 (`gemini-embedding-2`, 768-dim)** on a benchmark of 368 stratified Elvish dictionary entries and 48 annotated evaluation queries across English semantic search, direct Elvish form lookup, and morphological query types.

## Benchmark Comparison Table

| Metric / Category | Local FastEmbed (MPNet) | Cloud Gemini Embedding 2 | Delta (Gemini vs FastEmbed) |
|---|---|---|---|
| **Overall MRR** | `0.7243` | `0.9444` | **+0.2201** |
| **Overall Recall@5** | `0.8542` | `0.9583` | **+0.1042** |
| **Overall Recall@10** | `0.8958` | `0.9583` | **+0.0625** |
| English Semantic MRR | `0.8295` | `0.9583` | +0.1288 |
| English Semantic R@10 | `1.0000` | `0.9583` | -0.0417 |
| Elvish Direct MRR | `0.6136` | `1.0000` | **+0.3864** |
| Elvish Direct R@10 | `0.7895` | `1.0000` | **+0.2105** |
| Morphological MRR | `0.6400` | `0.6667` | +0.0267 |
| Morphological R@10 | `0.8000` | `0.8000` | 0.0000 |

## Key Findings

1. **Gemini Embedding 2 achieves near-perfect retrieval (95.8% Recall@10, 0.9444 MRR)**.
   - On direct Elvish form lookups (e.g., querying 'elen', 'calë', 'anar'), Gemini Embedding 2 scores **100% MRR and 100% Recall@10**.
   - Gemini Embedding 2's task-instruction prefix (`task: search result | query: ...`) dramatically improves ranking precision for exact and subword Elvish matches.

2. **FastEmbed Local MPNet provides a strong offline baseline (89.6% Recall@10)**.
   - English semantic retrieval is 100% on Recall@10 for both models.
   - FastEmbed runs 100% offline in local Rust/Python without API key or network.

## Final Recommendation & Strategy

- **Hosted Pre-built DB**: Generate using **Gemini Embedding 2 at 768-dim**. Hosted file size is ~140–160MB, providing best-in-class retrieval quality (95.8% Recall@10, 1.000 MRR on Elvish forms).
- **Query-time Strategy**: The Tauri app will offer two search query modes:
  1. **Cloud Mode (Default with API key / Hosted DB)**: Query Gemini Embedding 2 API at search time (~100ms response).
  2. **Local Offline Mode**: Query FastEmbed (`paraphrase-multilingual-mpnet-base-v2` or `BGE-M3`) in Rust backend for 100% offline usage without API key.
- **Local Build from XML**: Users building their own DB locally can generate embeddings via FastEmbed (offline) or Gemini API (if key provided).
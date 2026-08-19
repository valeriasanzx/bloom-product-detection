# Automated UGC Product Detection

A computer-vision pipeline that watches creator videos frame by frame and logs which product appears in each one — replacing a daily manual tagging task on an influencer marketing team.

**Built at:** Bloom Nutrition · **Role:** Influencer Marketing Data Analyst Intern · **2025–2026**

> ⚠️ **This is a case study, not the source.** The implementation was built during my internship, so the repository belongs to Bloom and stays private. The snippets here are rewritten to illustrate the two patterns that made the system work; they contain no company code, data, or model.

---

## The problem

Bloom's influencer marketing team received a continuous stream of TikTok and Instagram posts from creators. To report on which products creators were actually featuring, someone had to open every post, watch the video through, identify the product on screen, and log it into a tracker alongside impressions.

Three things were wrong with that:

- It scaled linearly with the creator roster.
- Two people watching the same video didn't always log the same thing.
- Impressions were stale the moment they were written — view counts keep climbing after a post is logged.

## The approach

An end-to-end pipeline that takes a post URL and returns a labeled, tracked record with no human in the loop.

The hard part is that most creator content is **video**, and a product may only be on screen for a second or two. Running detection on the thumbnail misses most of it. So the pipeline samples the whole video and aggregates detections across every frame.

```
Post URL ──► Download media ──► FFmpeg: 1 frame / 2s ──► Object detection (batched)
                    │                                              │
              scrape metadata                            filter to confidence ≥ 0.80
                    │                                              │
                    └──────────────► PostgreSQL ◄──────────────────┘
                                          ▲
                                    hourly refresh
                                  (impressions stay current)
```

| Stage | What happens |
|---|---|
| **Ingest** | Post URLs arrive individually or by CSV upload |
| **Download** | Media pulled from TikTok / Instagram; metadata scraped in parallel |
| **Sample** | FFmpeg extracts a frame every 2 seconds |
| **Detect** | Frames batched 5-at-a-time through a custom-trained detection model |
| **Aggregate** | Keeps detections ≥ 0.80 confidence, dedupes to unique products, ranks by best confidence |
| **Store** | Postgres record with products, confidence, hashtags, creator handle, post date |
| **Refresh** | Hourly scheduler re-scrapes impressions |

## Decisions worth explaining

**Sample every frame, not the thumbnail.**
A thumbnail is one arbitrary moment. Sampling at 0.5 fps and unioning detections across frames catches products that appear briefly, which is how creator content actually works. The cost is more API calls — so frames are batched, and a failure on one frame is swallowed rather than failing the whole post. See [`frame_aggregation.js`](snippets/frame_aggregation.js).

**A confidence floor instead of a best guess.**
The model always returns *something*. Anything under 0.80 is discarded rather than logged, so the tracker never quietly fills with wrong labels. An unlabeled post is a cheaper error than a confidently mislabeled one — a human can catch a blank, but not a plausible lie.

**Thumbnails in Postgres, not on disk.**
The first deploy lost every thumbnail on each restart: the container filesystem is ephemeral. I moved thumbnail bytes into a Postgres table rather than adding an object store — the images are small, and it removed a moving part instead of adding one.

**Idempotent ingest.**
Post URLs are normalized (trailing slash, query, fragment) before the duplicate check, so the same post submitted twice in different forms produces one record. See [`url_normalization.js`](snippets/url_normalization.js).

## Stack

Node.js · Express · PostgreSQL · Roboflow · FFmpeg · Next.js · TypeScript · Railway

---

**[← More of my work](https://github.com/valeriasanzx)**

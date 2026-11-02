#!/usr/bin/env python3
"""Collect the latest semiconductor headlines from Korean trade press into news.json.

Runs daily from .github/workflows/news.yml. Uses the Google News RSS search
restricted to trade-press sites, keeps only title / source / date / link, and
leaves news.json untouched when nothing could be fetched.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

# Trade press that covers the semiconductor industry in depth.
SITES = [
    "thelec.kr",        # 디일렉
    "etnews.com",       # 전자신문
    "ddaily.co.kr",     # 디지털데일리
    "e4ds.com",         # e4ds news
]
KEYWORD = "반도체"
DAYS = 7
KEEP = 12
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "news.json")
KST = timezone(timedelta(hours=9))


def feed_url():
    sites = " OR ".join("site:" + s for s in SITES)
    query = f"{KEYWORD} ({sites}) when:{DAYS}d"
    params = {"q": query, "hl": "ko", "gl": "KR", "ceid": "KR:ko"}
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(params)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; HISEM-news/1.0; +https://oh519.github.io/hisem/)"})
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def parse(xml_bytes):
    items = []
    for it in ET.fromstring(xml_bytes).iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        if source and title.endswith(" - " + source):
            title = title[: -len(source) - 3].strip()
        try:
            date = parsedate_to_datetime(it.findtext("pubDate") or "").astimezone(KST)
        except (TypeError, ValueError):
            continue
        if title and link.startswith("http"):
            items.append({"title": title, "source": source, "date": date.isoformat(timespec="minutes"), "link": link})
    return items


def dedupe(items):
    seen, out = set(), []
    for it in sorted(items, key=lambda x: x["date"], reverse=True):
        key = re.sub(r"\W+", "", it["title"]).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out[:KEEP]


def main():
    try:
        items = dedupe(parse(fetch(feed_url())))
    except Exception as exc:  # network or feed format problem: keep the old file
        print(f"fetch failed, keeping existing news.json: {exc}", file=sys.stderr)
        return 0
    if not items:
        print("no items found, keeping existing news.json", file=sys.stderr)
        return 0

    try:
        with open(OUT, encoding="utf-8") as f:
            if json.load(f).get("items") == items:
                print("no new articles")
                return 0
    except (OSError, ValueError):
        pass

    data = {"updated": datetime.now(KST).isoformat(timespec="minutes"), "items": items}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {len(items)} articles")
    return 0


if __name__ == "__main__":
    sys.exit(main())

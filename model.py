import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import json
import time
from requests.exceptions import RequestException, Timeout


class NewsAggregator:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0"
        }
        self.news_data = []
        self.seen_titles = set()  # for deduplication
        self.request_timeout = 12

    # -------------------------------
    # Utility: Add news (no duplicate)
    # -------------------------------
    def add_news(self, item):
        title_key = item["title"].strip().lower()

        if title_key not in self.seen_titles:
            self.seen_titles.add(title_key)
            self.news_data.append(item)

    # -------------------------------
    # Fetch Democracy Now
    # -------------------------------
    def fetch_democracy_now(self):
        url = "https://www.democracynow.org/democracynow.rss"

        try:
            res = requests.get(url, headers=self.headers, timeout=self.request_timeout)
            res.raise_for_status()
            root = ET.fromstring(res.content)
        except (RequestException, Timeout, ET.ParseError):
            return

        for item in root.findall(".//item"):
            title = item.findtext("title", default="N/A")
            link = item.findtext("link", default="N/A")
            summary = item.findtext("description", default="")

            full_text = self.get_full_article(link)

            news_item = {
                "source": "DemocracyNow",
                "title": title,
                "link": link,
                "summary": summary,
                "full_text": full_text,
                "published": None
            }

            self.add_news(news_item)
            time.sleep(1)

    # -------------------------------
    # Extract full article
    # -------------------------------
    def get_full_article(self, url):
        try:
            res = requests.get(url, headers=self.headers, timeout=self.request_timeout)
            res.raise_for_status()
            soup = BeautifulSoup(res.text, "html.parser")

            paragraphs = soup.select("div#transcript p")

            if not paragraphs:
                paragraphs = soup.select("article p")

            return " ".join(p.get_text(strip=True) for p in paragraphs)

        except (RequestException, Timeout):
            return ""

    # -------------------------------
    # Fetch Google News
    # -------------------------------
    def fetch_google_news(self):
        url = "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en"

        try:
            res = requests.get(url, headers=self.headers, timeout=self.request_timeout)
            res.raise_for_status()
            root = ET.fromstring(res.content)
        except (RequestException, Timeout, ET.ParseError):
            return

        for item in root.findall(".//item"):
            title = item.findtext("title", default="N/A")
            link = item.findtext("link", default="N/A")
            pub_date = item.findtext("pubDate", default="")
            source = item.find("source")

            news_item = {
                "source": source.text if source is not None else "GoogleNews",
                "title": title,
                "link": link,
                "summary": "",
                "full_text": "",
                "published": pub_date
            }

            self.add_news(news_item)

    # -------------------------------
    # Run all sources
    # -------------------------------
    def run(self):
        # Reset state at each run so one NewsAggregator instance
        # can be safely reused by a scheduler.
        self.news_data = []
        self.seen_titles = set()

        self.fetch_democracy_now()
        self.fetch_google_news()

        return {
            "status": "success",
            "total_articles": len(self.news_data),
            "data": self.news_data
        }


# -------------------------------
# MAIN EXECUTION
# -------------------------------
if __name__ == "__main__":
    scraper = NewsAggregator()
    result = scraper.run()

    json_output = json.dumps(result, indent=4, ensure_ascii=False)

    print(json_output)

    with open("combined_news.json", "w", encoding="utf-8") as f:
        f.write(json_output)
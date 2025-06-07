#!/usr/bin/env -S uv run --script

# /// script
# dependencies = [
#   "rich>=14.0.0",
#   "crawl4ai>=0.6.3",
# ]
# ///

"""
/// Example Usage

uv run hello.py
or
./hello.py

///
"""

import asyncio

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CacheMode,
    CrawlerRunConfig,
)
from crawl4ai.content_filter_strategy import PruningContentFilter
from crawl4ai.markdown_generation_strategy import DefaultMarkdownGenerator
from rich.console import Console


async def main():
    console = Console()

    md_generator = DefaultMarkdownGenerator(
        content_filter=PruningContentFilter(
            threshold=0.4, threshold_type="fixed"
        )
    )
    browser_conf = BrowserConfig(headless=True)
    run_conf = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS, markdown_generator=md_generator
    )

    async with AsyncWebCrawler(config=browser_conf) as crawler:
        result = await crawler.arun(
            url="https://crawl4ai.com", config=run_conf
        )
        console.print(
            "Raw Markdown length:", len(result.markdown.raw_markdown)
        )
        console.print(
            "Fit Markdown length:", len(result.markdown.fit_markdown)
        )


if __name__ == "__main__":
    asyncio.run(main())

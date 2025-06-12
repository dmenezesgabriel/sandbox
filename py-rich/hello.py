#!/usr/bin/env -S uv run --script

# /// script
# dependencies = [
#   "rich==14.0.0",
# ]
# ///

import logging
import os
import sys
from time import sleep

from rich.columns import Columns
from rich.console import Console, Group, group
from rich.logging import RichHandler
from rich.markdown import Markdown
from rich.padding import Padding
from rich.panel import Panel
from rich.progress import BarColumn, Progress, TextColumn, track
from rich.prompt import Confirm, Prompt
from rich.table import Column
from rich.text import Text

FORMAT = "%(message)s"
logging.basicConfig(
    level="NOTSET", format=FORMAT, datefmt="[%X]", handlers=[RichHandler()]
)

console = Console(color_system="auto")


def hello_world_styles():
    console.print("[italic red]Hello[/italic red] World!", locals())
    console.print("FOO", style="white on blue")


def log_json_and_rule():
    console.log("Hello, World!")
    console.print_json('[false, true, null, "foo"]')
    console.rule("[bold red]Chapter 2")


def status_example():
    with console.status("Working..."):
        sleep(1)


def fullscreen_screen_example():
    with console.screen():
        console.print(locals())
        sleep(2)


def panel_example():
    panel = Panel(Text("Hello", justify="left"))
    console.print(panel)


def logging_example():
    log = logging.getLogger("rich")
    log.info("Hello, World!")


def exception_example():
    try:
        do_something()
    except Exception:
        console.print_exception(show_locals=True)


def prompt_example():
    name = Prompt.ask(
        "Enter your name",
        choices=["Paul", "Jessica", "Duncan"],
        default="Paul",
    )
    is_rich_great = Confirm.ask("Do you like rich?")
    console.print(f"Name: {name}, Likes rich: {is_rich_great}")


def columns_example():
    directory = os.listdir(".")
    columns = Columns(directory, equal=True, expand=True)
    console.print(columns)


def group_panel_example():
    panel_group = Group(
        Panel("Hello", style="on blue"),
        Panel("World", style="on red"),
    )
    console.print(panel_group)


def dynamic_group_example():
    @group()
    def get_panels():
        yield Panel("Hello", style="on blue")
        yield Panel("World", style="on red")

    console.print(Panel(get_panels()))


# Optional dummy function to simulate an error
def do_something():
    raise ValueError("Simulated error for exception example.")


def markdown():
    MARKDOWN = """
# This is an h1

Rich can do a pretty *decent* job of rendering markdown.

1. This is a list item
2. This is another list item
"""
    md = Markdown(MARKDOWN)
    console.print(md)


def padding():
    test = Padding("Hello", (2, 4), style="on blue")
    console.print(test)


def tracking():
    for i in track(range(20), description="Processing..."):
        sleep(0.5)

    text_column = TextColumn(
        "{task.description}", table_column=Column(ratio=1)
    )
    bar_column = BarColumn(bar_width=None, table_column=Column(ratio=2))
    progress = Progress(text_column, bar_column, expand=True)

    with progress:
        for n in progress.track(range(100)):
            progress.print(n)
            sleep(0.1)


def main():
    # hello_world_styles()
    # log_json_and_rule()
    # status_example()
    # fullscreen_screen_example()
    # panel_example()
    # logging_example()
    # exception_example()
    # prompt_example()
    # columns_example()Markdown
    # group_panel_example()
    # dynamic_group_example()
    # markdown()
    # padding()
    tracking()


if __name__ == "__main__":
    main()

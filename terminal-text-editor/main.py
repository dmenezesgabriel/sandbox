# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "textual[syntax]>=0.58",
# ]
# ///
# usage: uv run main.py


import logging
from argparse import ArgumentParser
from functools import partial
from pathlib import Path
from typing import List, Optional, cast

from textual import events
from textual.app import App, ComposeResult
from textual.command import Hit, Provider
from textual.containers import Container, Horizontal
from textual.logging import TextualHandler
from textual.widgets import DirectoryTree, Footer, Header, TextArea

logging.basicConfig(
    level="NOTSET",
    handlers=[TextualHandler()],
)


EXTENSIONS = {
    ".py": "python",
    ".js": "javascript",
    ".html": "html",
    ".css": "css",
    ".txt": "text",
    ".md": "markdown",
    ".json": "json",
    ".xml": "xml",
}


class Commands(Provider):
    def read_files(self) -> List[Path]:
        paths = []
        folders = [self.app.folder]
        while folders:
            folder = folders.pop()
            for p in folder.iterdir():
                if p.name.startswith("."):
                    continue
                if p.is_dir():
                    folders.append(p)
                else:
                    paths.append(p)
        return paths

    async def search(self, query: str):
        matcher = self.matcher(query)
        for path in self.read_files():
            command = f"open {path}"
            score = matcher.match(command)
            if score > 0:
                yield Hit(
                    score,
                    matcher.highlight(command),
                    partial(self.app.edit_file, path),
                    help="Open file in editor",
                )


class ExtendedTextArea(TextArea):
    async def _on_key(self, event: events.Key) -> None:
        if event.character == "(":
            self.insert("()")
            self.move_cursor_relative(columns=-1)
            event.prevent_default()


class Editor(App[None]):
    TITLE = "Text Editor"

    CSS = """
    DirectoryTree {
        dock: left;
        width: 25%
    }
    """

    COMMANDS = {Commands}

    BINDINGS = [
        ("ctrl+s", "save_file", "Save File"),
        ("q", "quit", "Quit"),
        ("ctrl+p", "command_palette", "Open Command Palette"),
    ]

    def __init__(self, folder: Path, file: Optional[Path] = None) -> None:
        super().__init__()
        self.folder = folder
        self.file = file

    def compose(self) -> ComposeResult:
        self.current_editor = ExtendedTextArea.code_editor(
            id="editor", text="", language="", read_only=True
        )
        with Container():
            yield Header()
            yield Horizontal(
                DirectoryTree(self.folder),
                self.current_editor,
            )
            yield Footer()

    def on_ready(self):
        if self.file is not None:
            self.edit_file(self.file)

    def _on_directory_tree_file_selected(
        self, event: DirectoryTree.FileSelected
    ) -> None:
        self.edit_file(event.path)

    def edit_file(self, path: Path):
        if not path.is_file():
            return

        self.file = path
        text_editor = cast(ExtendedTextArea, self.query_one("#editor"))
        text_editor.text = self.file.read_text()
        text_editor.language = EXTENSIONS.get(self.file.suffix, "text")
        text_editor.read_only = False
        text_editor.focus()

    def action_save_file(self) -> None:
        if self.file is None:
            return

        editor = cast(ExtendedTextArea, self.query_one("#editor"))
        self.file.write_text(editor.text)
        self.notify(f"Saved {self.file.name}")


if __name__ == "__main__":
    parser = ArgumentParser(description="Text Editor")
    parser.add_argument("folder", type=Path, help="Folder to open")

    args = parser.parse_args()
    folder: Path = args.folder
    file: Optional[Path] = None

    if not folder.exists():
        raise FileNotFoundError(f"Folder {folder} does not exist")
    if not folder.is_dir():
        folder = folder.parent

    app = Editor(folder=args.folder, file=file)
    app.run()

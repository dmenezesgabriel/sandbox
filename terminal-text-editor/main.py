# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "textual[syntax]>=0.58",
# ]
# ///
# usage: uv run main.py


import logging
from argparse import ArgumentParser
from pathlib import Path
from typing import Optional

from textual import events
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal
from textual.logging import TextualHandler
from textual.widgets import DirectoryTree, Footer, Header, TextArea

logging.basicConfig(
    level="NOTSET",
    handlers=[TextualHandler()],
)


extensions = {
    ".py": "python",
    ".js": "javascript",
    ".html": "html",
    ".css": "css",
    ".txt": "text",
    ".md": "markdown",
    ".json": "json",
    ".xml": "xml",
}


class ExtendedTextArea(TextArea):
    async def _on_key(self, event: events.Key) -> None:
        if event.character == "(":
            self.insert("()")
            self.move_cursor_relative(columns=-1)
            event.prevent_default()


class Editor(App[None]):
    BINDINGS = [
        ("ctrl+s", "save_file", "Save File"),
        ("q", "quit", "Quit"),
    ]

    def __init__(self, folder: Path) -> None:
        super().__init__()
        self.folder = folder
        self.file: Optional[Path] = None

    def compose(self) -> ComposeResult:
        self.current_editor = ExtendedTextArea.code_editor(
            id="editor", text="", language=""
        )
        with Container():
            yield Header()
            yield Horizontal(
                DirectoryTree(self.folder),
                self.current_editor,
            )
            yield Footer()

    def _on_directory_tree_file_selected(
        self, event: DirectoryTree.FileSelected
    ) -> None:
        path: Path = event.path
        if not path.is_file():
            return

        self.file = path
        text_editor = self.query_one("#editor")
        text_editor.text = self.file.read_text()
        text_editor.language = extensions.get(self.file.suffix, "text")

    def action_save_file(self) -> None:
        if self.file is None:
            return

        editor = self.query_one("#editor")
        self.file.write_text(editor.text)
        self.notify(f"Saved {self.file.name}")


if __name__ == "__main__":
    parser = ArgumentParser(description="Text Editor")
    parser.add_argument("folder", type=Path, help="Folder to open")

    args = parser.parse_args()
    folder: Path = args.folder

    if not folder.exists():
        raise FileNotFoundError(f"Folder {folder} does not exist")
    if not folder.is_dir():
        folder = folder.parent

    app = Editor(folder=args.folder)
    app.run()

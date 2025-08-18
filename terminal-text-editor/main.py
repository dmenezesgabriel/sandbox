# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "textual[syntax]>=0.58",
# ]
# ///
# usage: uv run main.py


import logging

import textual
from textual import events
from textual.app import App, ComposeResult
from textual.containers import Container
from textual.logging import TextualHandler
from textual.widgets import Footer, Header, TextArea

logging.basicConfig(
    level="NOTSET",
    handlers=[TextualHandler()],
)


class File:
    def __init__(self, content: str = ""):
        self.content = content

    def save(self, filename: str) -> None:
        with open(filename, "w") as f:
            f.write(self.content)


class ExtendedTextArea(TextArea):
    async def _on_key(self, event: events.Key) -> None:
        if event.character == "(":
            self.insert("()")
            self.move_cursor_relative(columns=-1)
            event.prevent_default()


class TextEditor(App):
    BINDINGS = [("ctrl+s", "save", "Save File")]

    def compose(self) -> ComposeResult:
        self.current_editor = ExtendedTextArea.code_editor(
            text="", language=""
        )
        with Container():
            yield Header()
            yield self.current_editor
            yield Footer()

    def action_save(self) -> None:
        content = self.current_editor.text
        file = File(content)
        file.save("output.txt")
        self.notify("File saved")


if __name__ == "__main__":
    print(textual.__version__)

    app = TextEditor()
    app.run()

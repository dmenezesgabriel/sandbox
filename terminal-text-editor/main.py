# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "textual[syntax]>=0.58",
# ]
# ///
# usage: uv run main.py


import sys

import textual
from textual.app import App, ComposeResult
from textual.widgets import Footer, Header, TextArea


class TextEditor(App):
    BINDINGS = [("d", "toggle_dark", "Toggle dark mode")]

    def compose(self) -> ComposeResult:
        yield Header()
        yield TextArea.code_editor()
        yield Footer()

    def action_toggle_dark(self) -> None:
        """An action to toggle dark mode."""
        self.theme = (
            "textual-dark"
            if self.theme == "textual-light"
            else "textual-light"
        )


if __name__ == "__main__":
    print(textual.__version__)

    app = TextEditor()
    app.run()

    path = sys.argv[1] if len(sys.argv) > 1 else "."

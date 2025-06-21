import argparse
import ast
import builtins
import importlib
import inspect
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

# ---------- Strategy Interfaces ----------


class SymbolResolverStrategy(ABC):
    @abstractmethod
    def resolve(self, name: str) -> Optional[Any]:
        pass


# ---------- Concrete Strategies ----------


class BuiltinResolver(SymbolResolverStrategy):
    def resolve(self, name: str) -> Optional[Any]:
        return getattr(builtins, name, None)


class ImportResolver(SymbolResolverStrategy):
    def __init__(self, imported_modules: Dict[str, Any]):
        self.imported_modules = imported_modules

    def resolve(self, name: str) -> Optional[Any]:
        return self.imported_modules.get(name)


class GlobalResolver(SymbolResolverStrategy):
    def resolve(self, name: str) -> Optional[Any]:
        return globals().get(name)


# ---------- Factory ----------


class ResolverFactory:
    def __init__(self, import_table: Dict[str, Any]):
        self.strategies = [
            ImportResolver(import_table),
            GlobalResolver(),
            BuiltinResolver(),
        ]

    def resolve(self, name: str) -> Optional[Any]:
        for strategy in self.strategies:
            obj = strategy.resolve(name)
            if obj is not None:
                return obj
        return None


# ---------- Analyzer Class ----------


class CodeAnalyzer:
    def __init__(self, code: str):
        self.code = code
        self.tree = ast.parse(code)
        self.imports: Dict[str, Any] = {}
        self.resolver_factory: Optional[ResolverFactory] = None

    def analyze(self):
        self._collect_imports()
        self.resolver_factory = ResolverFactory(self.imports)
        self._analyze_nodes()

    def _collect_imports(self):
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    module = self._safe_import(alias.name)
                    if not module:
                        continue
                    self.imports[alias.asname or alias.name] = module
            elif isinstance(node, ast.ImportFrom):
                module = self._safe_import(node.module)
                if not module:
                    continue
                for alias in node.names:
                    if hasattr(module, alias.name):
                        self.imports[alias.asname or alias.name] = getattr(
                            module, alias.name
                        )

    def _safe_import(self, module_name: str) -> Optional[Any]:
        try:
            return importlib.import_module(module_name)
        except Exception:
            return None

    def _analyze_nodes(self):
        for node in ast.walk(self.tree):
            if isinstance(node, ast.Call):
                self._analyze_function_call(node)
                continue
            if isinstance(node, ast.Attribute):
                self._analyze_attribute_access(node)

    def _analyze_function_call(self, node: ast.Call):
        func = node.func
        if isinstance(func, ast.Name):
            self._validate_name_function(func.id)
            return
        if isinstance(func, ast.Attribute):
            self._validate_attribute_chain(func)

    def _analyze_attribute_access(self, node: ast.Attribute):
        if not isinstance(node.value, ast.Name):
            return

        obj = self.resolver_factory.resolve(node.value.id)
        if obj and not hasattr(obj, node.attr):
            print(
                f"❌ Attribute '{node.attr}' not found in '{node.value.id}'. Available: {dir(obj)}"
            )

    def _validate_name_function(self, name: str):
        obj = self.resolver_factory.resolve(name)
        if not obj:
            print(f"❌ Function '{name}' not found.")
            return

        self._print_signature_or_note(name, obj)

    def _validate_attribute_chain(self, node: ast.Attribute):
        attributes = []
        while isinstance(node, ast.Attribute):
            attributes.insert(0, node.attr)
            node = node.value

        if not isinstance(node, ast.Name):
            return

        attributes.insert(0, node.id)
        obj = self.resolver_factory.resolve(attributes[0])
        if not obj:
            print(f"❌ Module or object '{attributes[0]}' not found.")
            return

        for attr in attributes[1:]:
            if not hasattr(obj, attr):
                print(
                    f"❌ '{'.'.join(attributes)}': '{attr}' not found in '{obj}'. Available: {dir(obj)}"
                )
                return
            obj = getattr(obj, attr)

        self._print_signature_or_note(".".join(attributes), obj)

    def _print_signature_or_note(self, name: str, obj: Any):
        try:
            sig = inspect.signature(obj)
            print(f"✅ '{name}' found with signature: {sig}")
        except Exception:
            print(f"✅ '{name}' found (no signature available)")


# ---------- CLI Entry Point ----------


def main():
    parser = argparse.ArgumentParser(
        description="Analyze Python code for invalid function and attribute usage."
    )
    parser.add_argument("file", help="Path to the Python file to analyze")
    args = parser.parse_args()

    try:
        with open(args.file, "r") as f:
            code = f.read()
        analyzer = CodeAnalyzer(code)
        analyzer.analyze()
    except FileNotFoundError:
        print(f"❌ File not found: {args.file}")
    except Exception as e:
        print(f"❌ Error analyzing file: {e}")


if __name__ == "__main__":
    main()

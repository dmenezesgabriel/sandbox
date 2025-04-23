import React, { createContext, useContext, useState } from "react";
import { ChevronDown, Search, Trash2 } from "lucide-react";

type ComboboxContextType = {
  open: boolean;
  setOpen: (value: boolean) => void;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  search: string;
  setSearch: (value: string) => void;
};

const ComboboxContext = createContext<ComboboxContextType | undefined>(
  undefined
);

function useCombobox() {
  const context = useContext(ComboboxContext);
  if (!context) throw new Error("Use Combobox components within Combobox.Root");
  return context;
}

export function Root({
  children,
  selected,
  setSelected,
}: {
  children: React.ReactNode;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <ComboboxContext.Provider
      value={{ open, setOpen, selected, setSelected, search, setSearch }}
    >
      <div className="multiselect">{children}</div>
    </ComboboxContext.Provider>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="multiselect__label">{children}</label>;
}

export function Trigger({ text }: { text: string }) {
  const { open, setOpen } = useCombobox();

  return (
    <div
      className={`multiselect__trigger ${
        open ? "multiselect__trigger--active" : "multiselect__trigger--inactive"
      }`}
      onClick={() => setOpen(!open)}
    >
      <div className="multiselect__text">{text}</div>
      <ChevronDown className="multiselect__icon" />
    </div>
  );
}

export function Content({ children }: { children: React.ReactNode }) {
  const { open } = useCombobox();
  if (!open) return null;

  return <div className="multiselect__dropdown">{children}</div>;
}

export function SearchBox() {
  const { search, setSearch, setSelected } = useCombobox();

  return (
    <div className="multiselect__search">
      <Search className="multiselect__search-icon" />
      <input
        type="text"
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="multiselect__search-input"
      />
      <button onClick={() => setSelected([])} className="multiselect__clear">
        <Trash2 className="multiselect__search-icon" /> limpar tudo
      </button>
    </div>
  );
}

interface OptionProps {
  value: string;
}

export function Options({ children }: { children: React.ReactNode }) {
  const { search } = useCombobox();
  const filteredChildren = React.Children.toArray(children).filter((child) => {
    if (!React.isValidElement<OptionProps>(child)) return false;
    return child.props.value.toLowerCase().includes(search.toLowerCase());
  });

  return <ul className="multiselect__options">{filteredChildren}</ul>;
}

export function Option({ value }: OptionProps) {
  const { selected, setSelected } = useCombobox();

  const toggleOption = (option: string) => {
    setSelected((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  const truncateText = (text: string, maxLength: number = 40): string => {
    return text.length > maxLength
      ? text.slice(0, maxLength - 3) + "..."
      : text;
  };

  return (
    <li className="multiselect__option">
      <input
        type="checkbox"
        checked={selected.includes(value)}
        onChange={() => toggleOption(value)}
        className="multiselect__checkbox"
      />
      {truncateText(value)}
    </li>
  );
}

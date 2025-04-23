import React, { createContext, useContext, useState } from "react";
import { ChevronDown, Search, Trash2 } from "lucide-react";

interface SelectContextType {
  open: boolean;
  setOpen: (value: boolean) => void;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  search: string;
  setSearch: (value: string) => void;
  multiple?: boolean;
  showCheckbox?: boolean;
  options: string[];
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);

const useSelectContext = () => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error(
      "Select compound components must be used within Select.Root"
    );
  }
  return context;
};

interface RootProps {
  children: React.ReactNode;
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
  options: string[];
  multiple?: boolean;
  showCheckbox?: boolean;
}

function Root({
  children,
  selected,
  setSelected,
  options,
  multiple = true,
  showCheckbox = true,
}: RootProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <SelectContext.Provider
      value={{
        open,
        setOpen,
        selected,
        setSelected,
        search,
        setSearch,
        multiple,
        showCheckbox,
        options,
      }}
    >
      <div className="multiselect">{children}</div>
    </SelectContext.Provider>
  );
}

interface TriggerProps {
  label: string;
}

function Trigger({ label }: TriggerProps) {
  const { open, setOpen, selected } = useSelectContext();

  const selectedLabel = (): string => {
    if (selected.length === 0) return `Escolha ${label}`;
    const remainingCount = selected.length - 1;
    const firstText = truncateText(selected[0], remainingCount > 0 ? 18 : 25);
    return remainingCount > 0 ? `${firstText} +${remainingCount}` : firstText;
  };

  const truncateText = (text: string, maxLength: number = 25): string => {
    return text.length > maxLength
      ? text.slice(0, maxLength - 3) + "..."
      : text;
  };

  return (
    <>
      <label className="multiselect__label">{label}</label>
      <div
        className={`multiselect__trigger ${
          open
            ? "multiselect__trigger--active"
            : "multiselect__trigger--inactive"
        }`}
        onClick={() => setOpen(!open)}
      >
        <div className="multiselect__text">{selectedLabel()}</div>
        <ChevronDown className="multiselect__icon" />
      </div>
    </>
  );
}

function Content() {
  const {
    open,
    search,
    setSearch,
    selected,
    setSelected,
    multiple,
    showCheckbox,
    options,
  } = useSelectContext();

  const clearAll = () => setSelected([]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (option: string) => {
    if (!multiple) {
      setSelected([option]);
      return;
    }

    setSelected((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  if (!open) return null;

  return (
    <div className="multiselect__dropdown">
      <div className="multiselect__search">
        <Search className="multiselect__search-icon" />
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="multiselect__search-input"
        />
        {multiple && (
          <button onClick={clearAll} className="multiselect__clear">
            <Trash2 className="multiselect__search-icon" /> limpar tudo
          </button>
        )}
      </div>
      <ul className="multiselect__options">
        {filteredOptions.map((opt) => (
          <li
            key={opt}
            className="multiselect__option"
            onClick={() => toggleOption(opt)}
          >
            {showCheckbox && (
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => {}}
                className="multiselect__checkbox"
              />
            )}
            {opt}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Select = {
  Root,
  Trigger,
  Content,
};

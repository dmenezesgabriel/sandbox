import React from "react";
import { X } from "lucide-react";
import * as Combobox from "../Combobox";

export function Root({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="filter">
      <h2 className="filter__title">{title}</h2>
      {children}
    </div>
  );
}

export function Container({ children }: { children: React.ReactNode }) {
  return <div className="filter__container">{children}</div>;
}

export function Chips({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (item: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="filter__tags">
      {items.map((item) => (
        <span key={item} className="filter__tag">
          {item}
          <X className="filter__tag-remove" onClick={() => onRemove(item)} />
        </span>
      ))}
    </div>
  );
}

type ComboProps = {
  label: string;
  options: string[];
  selected: string[];
  setSelected: React.Dispatch<React.SetStateAction<string[]>>;
};

export function Combo({ label, options, selected, setSelected }: ComboProps) {
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
    <Combobox.Root selected={selected} setSelected={setSelected}>
      <Combobox.Label>{label}</Combobox.Label>
      <Combobox.Trigger text={selectedLabel()} />
      <Combobox.Content>
        <Combobox.SearchBox />
        <Combobox.Options>
          {options.map((opt) => (
            <Combobox.Option key={opt} value={opt} />
          ))}
        </Combobox.Options>
      </Combobox.Content>
    </Combobox.Root>
  );
}

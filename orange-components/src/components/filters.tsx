import { useState } from "react";
import * as Filter from "./Filter";

const businessData = [
  "01234584365734867934-TEXTO-MUITO-LONGO-QUE-NAO-CABERIA-NO-COMBOBOX",
  "Banana",
  "Abacaxi",
  "Fruta do conde",
];

const guardrailData = ["status verde", "status vermelho"];

export function PortfolioFilter() {
  const [selectedBusiness, setSelectedBusiness] = useState<string[]>([]);
  const [selectedGuardrails, setSelectedGuardrails] = useState<string[]>([]);

  const handleRemoveItem = (item: string) => {
    setSelectedBusiness((prev) => prev.filter((i) => i !== item));
    setSelectedGuardrails((prev) => prev.filter((i) => i !== item));
  };

  const selectedItems = [...selectedBusiness, ...selectedGuardrails];

  return (
    <Filter.Root title="Business">
      <Filter.Container>
        <Filter.Combo
          label="Business"
          options={businessData}
          selected={selectedBusiness}
          setSelected={setSelectedBusiness}
        />
        <Filter.Combo
          label="Guardrail"
          options={guardrailData}
          selected={selectedGuardrails}
          setSelected={setSelectedGuardrails}
        />
      </Filter.Container>
      <Filter.Chips items={selectedItems} onRemove={handleRemoveItem} />
    </Filter.Root>
  );
}

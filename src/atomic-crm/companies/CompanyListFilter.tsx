import { Truck } from "lucide-react";
import { FilterLiveForm } from "ra-core";

import { ToggleFilterButton, SearchInput } from "@/components/admin";
import { FilterCategory } from "../filters/FilterCategory";

const retailerTypes = [
  { id: "Retailer (No Discount)", name: "Retailer (No Discount)" },
  { id: "Retailer (With Discount)", name: "Retailer (With Discount)" },
  { id: "USVA", name: "USVA" },
];

export const CompanyListFilter = () => {
  return (
    <div className="w-52 min-w-52 flex flex-col gap-8">
      <FilterLiveForm>
        <SearchInput source="q" />
      </FilterLiveForm>

      <FilterCategory icon={<Truck className="h-4 w-4" />} label="Retailer Type">
        {retailerTypes.map((retailerType) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={retailerType.name}
            value={{ sector: retailerType.id }}
          />
        ))}
      </FilterCategory>
    </div>
  );
};

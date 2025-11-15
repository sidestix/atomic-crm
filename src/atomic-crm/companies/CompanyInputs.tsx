import {
  TextInput,
  SelectInput,
  AutocompleteInput,
} from "@/components/admin";
import { Separator } from "@/components/ui/separator";
import { useIsMobile } from "@/hooks/use-mobile";
import { required, useRecordContext } from "ra-core";
import ImageEditorField from "../misc/ImageEditorField";
import { countries } from "../contacts/countries";
import type { Company } from "../types";

const isUrl = (url: string) => {
  if (!url) return;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(url)) {
    return "Must be a valid URL";
  }
};

export const CompanyInputs = () => {
  const isMobile = useIsMobile();

  return (
    <div className="flex flex-col gap-4 p-1">
      <CompanyDisplayInputs />
      <div className={`flex gap-6 ${isMobile ? "flex-col" : "flex-row"}`}>
        <div className="flex flex-col gap-10 flex-1">
          <CompanyContactInputs />
          <CompanyContextInputs />
        </div>
        <Separator orientation={isMobile ? "horizontal" : "vertical"} />
        <div className="flex flex-col gap-8 flex-1">
          <CompanyAddressInputs />
          <CompanyAdditionalInformationInputs />
        </div>
      </div>
    </div>
  );
};

const CompanyDisplayInputs = () => {
  const record = useRecordContext<Company>();
  return (
    <div className="flex gap-4 flex-1 flex-row">
      <ImageEditorField
        source="logo"
        type="avatar"
        width={60}
        height={60}
        emptyText={record?.name.charAt(0)}
        linkPosition="bottom"
      />
      <TextInput
        source="name"
        className="w-full h-fit"
        validate={required()}
        helperText={false}
        placeholder="Company name"
      />
    </div>
  );
};

const CompanyContactInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Contact</h6>
      <TextInput source="website" helperText={false} validate={isUrl} />
      <TextInput source="phone_number" helperText={false} />
    </div>
  );
};

const CompanyContextInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Context</h6>
      <SelectInput
        source="sector"
        label="Retailer Type"
        choices={[
          { id: "Retailer (No Discount)", name: "Retailer (No Discount)" },
          { id: "Retailer (With Discount)", name: "Retailer (With Discount)" },
          { id: "USVA", name: "USVA" },
        ]}
        helperText={false}
      />
    </div>
  );
};

const CompanyAddressInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Address</h6>
      <TextInput source="address" helperText={false} />
      <TextInput source="city" helperText={false} />
      <TextInput source="zipcode" label="Postal/Zip Code" helperText={false} />
      <TextInput source="stateAbbr" label="Province/State (Abbreviation)" helperText={false} />
      <AutocompleteInput
        source="country"
        choices={countries}
        optionText="name"
        optionValue="name"
        placeholder="Search countries..."
        helperText={false}
      />
    </div>
  );
};

const CompanyAdditionalInformationInputs = () => {
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Billing/Shipping Instructions</h6>
      <TextInput source="description" label="Billing Instructions" multiline helperText={false} />
      <TextInput source="shipping_instructions" label="Shipping Instructions" multiline helperText={false} />
    </div>
  );
};

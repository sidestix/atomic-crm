import { Globe, Phone } from "lucide-react";
import { useRecordContext } from "ra-core";
import {
  EditButton,
  ReferenceField,
  ShowButton,
  TextField,
  DateField,
  UrlField,
} from "@/components/admin";

import { AsideSection } from "../misc/AsideSection";
import { SaleName } from "../sales/SaleName";
import type { Company } from "../types";
import { ReferenceManyField } from "@/components/admin";
import { TasksIterator } from "../tasks/TasksIterator";
import { AddTask } from "../tasks/AddTask";

interface CompanyAsideProps {
  link?: string;
}

export const CompanyAside = ({ link = "edit" }: CompanyAsideProps) => {
  const record = useRecordContext<Company>();
  if (!record) return null;

  return (
    <div className="hidden sm:block w-[250px] min-w-[250px] space-y-4">
      <div className="flex flex-row space-x-1">
        {link === "edit" ? (
          <EditButton label="Edit Company" />
        ) : (
          <ShowButton label="Show Company" />
        )}
      </div>

      <CompanyInfo record={record} />

      <AddressInfo record={record} />

      <ContextInfo record={record} />

      <BillingInstructions record={record} />
      <ShippingInstructions record={record} />
      <TasksSection />
      <AdditionalInfo record={record} />
    </div>
  );
};

const CompanyInfo = ({ record }: { record: Company }) => {
  if (!record.website && !record.phone_number) {
    return null;
  }

  return (
    <AsideSection title="Company Info">
      {record.website && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Globe className="w-4 h-4" />
          <UrlField
            source="website"
            target="_blank"
            rel="noopener"
            content={record.website
              .replace("http://", "")
              .replace("https://", "")}
          />
        </div>
      )}
      {record.phone_number && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Phone className="w-4 h-4" />
          <TextField source="phone_number" />
        </div>
      )}
    </AsideSection>
  );
};

const ContextInfo = ({ record }: { record: Company }) => {
  if (!record.sector) {
    return null;
  }

  return (
    <AsideSection title="Context">
      {record.sector && (
        <TextField source="sector" />
      )}
    </AsideSection>
  );
};

const AddressInfo = ({ record }: { record: Company }) => {
  if (!record.address && !record.city && !record.zipcode && !record.stateAbbr) {
    return null;
  }

  return (
    <AsideSection title="Main Address" noGap>
      <TextField source="address" />
      <TextField source="city" />
      <TextField source="zipcode" />
      <TextField source="stateAbbr" />
      <TextField source="country" />
    </AsideSection>
  );
};

const BillingInstructions = ({ record }: { record: Company }) => {
  if (!record.description) {
    return null;
  }

  return (
    <AsideSection title="Billing Instructions">
      <p className="text-sm">{record.description}</p>
    </AsideSection>
  );
};

const ShippingInstructions = ({ record }: { record: Company }) => {
  if (!record.shipping_instructions) {
    return null;
  }

  return (
    <AsideSection title="Shipping Instructions">
      <p className="text-sm">{record.shipping_instructions}</p>
    </AsideSection>
  );
};

const TasksSection = () => {
  return (
    <AsideSection title="Tasks">
      <ReferenceManyField
        target="company_id"
        reference="tasks"
        sort={{ field: "due_date", order: "ASC" }}
      >
        <TasksIterator />
      </ReferenceManyField>
      <AddTask />
    </AsideSection>
  );
};

const AdditionalInfo = ({ record }: { record: Company }) => {
  if (
    !record.created_at &&
    !record.sales_id
  ) {
    return null;
  }

  return (
    <AsideSection>
      {record.sales_id !== null && (
        <div className="inline-flex text-sm text-muted-foreground mb-1">
          Followed by&nbsp;
          <ReferenceField source="sales_id" reference="sales" record={record}>
            <SaleName />
          </ReferenceField>
        </div>
      )}
      {record.created_at && (
        <p className="text-sm text-muted-foreground mb-1">
          Added on{" "}
          <DateField
            source="created_at"
            record={record}
            options={{
              year: "numeric",
              month: "long",
              day: "numeric",
            }}
          />
        </p>
      )}
    </AsideSection>
  );
};

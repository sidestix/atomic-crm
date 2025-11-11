import { Mail, Phone } from "lucide-react";
import { useRecordContext, WithRecord } from "ra-core";
import { AddTask } from "../tasks/AddTask";
import { TasksIterator } from "../tasks/TasksIterator";
import { TagsListEdit } from "./TagsListEdit";
import { ManualDiscountsListEdit } from "./ManualDiscountsListEdit";

import {
  ArrayField,
  EditButton,
  ReferenceManyField,
  ShowButton,
  SingleFieldList,
  TextField,
  DateField,
  EmailField,
} from "@/components/admin";
import type { ReactNode } from "react";
import { AsideSection } from "../misc/AsideSection";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Contact } from "../types";
import { RelatedContactsDisplay } from "./RelatedContactsDisplay";

export const ContactAside = ({ link = "edit" }: { link?: "edit" | "show" }) => {
  const { contactGender } = useConfigurationContext();
  const record = useRecordContext<Contact>();
  if (!record) return null;
  return (
    <div className="hidden sm:block w-64 min-w-64 text-sm">
      <div className="mb-4 -ml-1">
        {link === "edit" ? (
          <EditButton label="Edit Contact" />
        ) : (
          <ShowButton label="Show Contact" />
        )}
      </div>

      <AsideSection title="Personal info">
        <ArrayField source="email_jsonb">
          <SingleFieldList className="flex-col">
            <PersonalInfoRow
              icon={<Mail className="w-4 h-4 text-muted-foreground" />}
              primary={<EmailField source="email" />}
            />
          </SingleFieldList>
        </ArrayField>

        <ArrayField source="phone_jsonb">
          <SingleFieldList className="flex-col">
            <PersonalInfoRow
              icon={<Phone className="w-4 h-4 text-muted-foreground" />}
              primary={<TextField source="number" />}
              showType
            />
          </SingleFieldList>
        </ArrayField>
        {contactGender
          .map((genderOption) => {
            if (record.gender === genderOption.value) {
              return (
                <PersonalInfoRow
                  key={genderOption.value}
                  icon={null}
                  primary={
                    <span>
                      <span className="text-muted-foreground">Pronouns: </span>
                      {genderOption.label}
                    </span>
                  }
                />
              );
            }
            return null;
          })
          .filter(Boolean)}
      </AsideSection>

      <AddressInfo record={record} />

      <AsideSection title="Activity">
        <div className="text-muted-foreground">
          <span className="text-sm">Added on</span>{" "}
          <DateField
            source="first_seen"
            options={{ year: "numeric", month: "long", day: "numeric" }}
          />
        </div>

        <div className="text-muted-foreground">
          <span className="text-sm">Last activity on</span>{" "}
          <DateField
            source="last_seen"
            options={{ year: "numeric", month: "long", day: "numeric" }}
          />
        </div>
      </AsideSection>

      <AsideSection title="Related contacts">
        <RelatedContactsDisplay />
      </AsideSection>

      <AsideSection title="Customer Type">
        <TagsListEdit />
      </AsideSection>

      <AsideSection title="Manual Discounts">
        <ManualDiscountsListEdit />
      </AsideSection>

      <AsideSection title="Tasks">
        <ReferenceManyField
          target="contact_id"
          reference="tasks"
          sort={{ field: "due_date", order: "ASC" }}
        >
          <TasksIterator />
        </ReferenceManyField>
        <AddTask />
      </AsideSection>
    </div>
  );
};

const AddressInfo = ({ record }: { record: Contact }) => {
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

const PersonalInfoRow = ({
  icon,
  primary,
  showType,
}: {
  icon: ReactNode;
  primary: ReactNode;
  showType?: boolean;
}) => (
  <div className="flex flex-row items-center gap-2 min-h-6">
    {icon}
    <div className="flex flex-wrap gap-x-2 gap-y-0">
      {primary}
      {showType ? (
        <WithRecord
          render={(row) =>
            row.type !== "Other" && (
              <TextField source="type" className="text-muted-foreground" />
            )
          }
        />
      ) : null}
    </div>
  </div>
);

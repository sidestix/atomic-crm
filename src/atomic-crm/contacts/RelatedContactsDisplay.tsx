import { ReferenceArrayField, SingleFieldList } from "@/components/admin";
import { useRecordContext } from "ra-core";
import { Link } from "react-router";
import type { Contact } from "../types";

const RelatedContactLink = () => {
  const record = useRecordContext<Contact>();
  if (!record) return null;
  
  const name = `${record.first_name || ""} ${record.last_name || ""}`.trim();
  if (!name) return null;
  
  return (
    <Link
      to={`/contacts/${record.id}/show`}
      className="text-sm text-primary hover:underline"
    >
      {name}
    </Link>
  );
};

export const RelatedContactsDisplay = () => {
  const record = useRecordContext<Contact>();
  
  if (!record?.related_contact_ids || record.related_contact_ids.length === 0) {
    return null;
  }
  
  return (
    <ReferenceArrayField
      source="related_contact_ids"
      reference="contacts_summary"
      resource="contacts"
    >
      <SingleFieldList className="flex-col gap-1">
        <RelatedContactLink />
      </SingleFieldList>
    </ReferenceArrayField>
  );
};


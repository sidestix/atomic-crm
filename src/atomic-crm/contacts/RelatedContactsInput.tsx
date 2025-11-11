import { ReferenceArrayInput } from "@/components/admin";
import { AutocompleteArrayInput } from "@/components/admin";
import { useRecordContext } from "ra-core";
import { contactOptionText } from "../misc/ContactOption";
import type { Contact } from "../types";

export const RelatedContactsInput = () => {
  const record = useRecordContext<Contact>();
  
  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">Related contacts</h6>
      <ReferenceArrayInput
        source="related_contact_ids"
        reference="contacts_summary"
        filter={record?.id ? { "id@neq": record.id } : {}}
      >
        <AutocompleteArrayInput
          label="Related contacts"
          optionText={contactOptionText}
          helperText={false}
          placeholder="Search contacts..."
        />
      </ReferenceArrayInput>
    </div>
  );
};


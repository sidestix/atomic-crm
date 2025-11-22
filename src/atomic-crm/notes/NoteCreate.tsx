import type { Identifier, RaRecord } from "ra-core";
import {
  CreateBase,
  Form,
  useGetIdentity,
  useListContext,
  useNotify,
  useRecordContext,
  useResourceContext,
  useUpdate,
} from "ra-core";
import { useFormContext } from "react-hook-form";
import { SaveButton } from "@/components/admin";
import { cn } from "@/lib/utils";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { NoteInputs } from "./NoteInputs";
import { format } from "date-fns";

const foreignKeyMapping = {
  contacts: "contact_id",
  deals: "deal_id",
  companies: "company_id",
} as const;

export const NoteCreate = ({
  reference,
  showStatus,
  className,
}: {
  reference: "contacts" | "deals" | "companies";
  showStatus?: boolean;
  className?: string;
}) => {
  const resource = useResourceContext();
  const record = useRecordContext();
  const { identity } = useGetIdentity();
  const { enableDeals } = useConfigurationContext();

  // Safety check: don't render if deals are disabled and reference is deals
  if (reference === "deals" && !enableDeals) {
    return null;
  }

  if (!record || !identity) return null;

  return (
    <CreateBase resource={resource} redirect={false}>
      <Form>
        <div className={cn("space-y-3", className)}>
          <NoteInputs showStatus={showStatus} />
          <NoteCreateButton reference={reference} record={record} />
        </div>
      </Form>
    </CreateBase>
  );
};

const NoteCreateButton = ({
  reference,
  record,
}: {
  reference: "contacts" | "deals" | "companies";
  record: RaRecord<Identifier>;
}) => {
  const [update] = useUpdate();
  const notify = useNotify();
  const { identity } = useGetIdentity();
  const { reset } = useFormContext();
  const { refetch } = useListContext();

  if (!record || !identity) return null;

  const resetValues: {
    date: string;
    text: null;
    attachments: null;
  } = {
    date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    text: null,
    attachments: null,
  };

  const handleSuccess = (data: any) => {
    reset(resetValues, { keepValues: false });
    refetch();
    // Only update contact-specific fields for contacts
    if (reference === "contacts") {
      update(reference, {
        id: (record && record.id) as unknown as Identifier,
        data: { last_seen: new Date().toISOString() },
        previousData: record,
      });
    }
    notify("Note added");
  };

  return (
    <div className="flex justify-end">
      <SaveButton
        type="button"
        label="Add this note"
        transform={(data) => ({
          ...data,
          [foreignKeyMapping[reference]]: record.id,
          sales_id: identity.id,
          date: data.date
            ? new Date(data.date).toISOString()
            : new Date().toISOString()
        })}
        mutationOptions={{
          onSuccess: handleSuccess,
        }}
      >
        Add this note
      </SaveButton>
    </div>
  );
};

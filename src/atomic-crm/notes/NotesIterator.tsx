import { useListContext } from "ra-core";
import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { Note } from "./Note";
import { NoteCreate } from "./NoteCreate";

export const NotesIterator = ({
  reference,
  showStatus,
  highlightedNote,
}: {
  reference: "contacts" | "deals" | "companies";
  showStatus?: boolean;
  highlightedNote?: string | null;
}) => {
  const { enableDeals } = useConfigurationContext();
  const { data, error, isPending } = useListContext();
  
  // Safety check: don't render if deals are disabled and reference is deals
  if (reference === "deals" && !enableDeals) {
    return null;
  }
  
  if (isPending || error) return null;
  return (
    <div className="mt-4">
      <NoteCreate reference={reference} showStatus={showStatus} />
      {data && (
        <div className="mt-4 space-y-4">
          {data.map((note, index) => (
            <React.Fragment key={index}>
              <Note
                note={note}
                isLast={index === data.length - 1}
                key={index}
                showStatus={showStatus}
                id={note.id?.toString()}
                highlightedNote={highlightedNote}
              />
              {index < data.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

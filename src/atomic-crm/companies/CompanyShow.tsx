import { ShowBase, useShowContext } from "ra-core";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ReferenceManyField } from "@/components/admin";

import type { Company } from "../types";
import { CompanyAside } from "./CompanyAside";
import { CompanyAvatar } from "./CompanyAvatar";
import { NoteCreate, NotesIterator } from "../notes";

export const CompanyShow = () => (
  <ShowBase>
    <CompanyShowContent />
  </ShowBase>
);

const CompanyShowContent = () => {
  const { record, isPending } = useShowContext<Company>();
  const [searchParams] = useSearchParams();
  const noteId = searchParams.get('note');
  const [highlightedNote, setHighlightedNote] = useState<string | null>(null);
  const hasExecuted = useRef(false);
  
  // Handle scroll to note when noteId changes
  useEffect(() => {
    if (noteId && !hasExecuted.current) {
      hasExecuted.current = true;
      const tryScroll = (attempts = 0) => {
        const element = document.getElementById(`note-${noteId}`);
        
        if (element) {
          setHighlightedNote(noteId);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Remove highlight after fade completes
          setTimeout(() => setHighlightedNote(null), 1000);
          return;
        } else if (attempts < 20) {
          // Retry every 100ms for up to 2 seconds
          setTimeout(() => tryScroll(attempts + 1), 100);
        }
      };
      
      // Start with a delay to let the page settle
      setTimeout(() => tryScroll(), 100);
    }
  }, [noteId]);

  if (isPending || !record) return null;

  return (
    <div className="mt-2 flex pb-2 gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex mb-3">
              <CompanyAvatar />
              <h5 className="text-xl ml-2 flex-1">{record.name}</h5>
            </div>
            <ReferenceManyField
              target="company_id"
              reference="companyNotes"
              sort={{ field: "date", order: "DESC" }}
              perPage={1000}
              empty={
                <NoteCreate reference="companies" showStatus className="mt-4" />
              }
            >
              <NotesIterator reference="companies" showStatus highlightedNote={highlightedNote} />
            </ReferenceManyField>
          </CardContent>
        </Card>
      </div>
      <CompanyAside />
    </div>
  );
};

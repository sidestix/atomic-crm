import {
  ReferenceManyField,
} from "@/components/admin";
import { Card, CardContent } from "@/components/ui/card";
import { ShowBase, useShowContext } from "ra-core";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { NoteCreate, NotesIterator } from "../notes";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";
import { ContactAside } from "./ContactAside";

export const ContactShow = () => (
  <ShowBase>
    <ContactShowContent />
  </ShowBase>
);

const ContactShowContent = () => {
  const { record, isPending } = useShowContext<Contact>();
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
        console.log(`Attempt ${attempts + 1}: Looking for note-${noteId}`, element);
        
        if (element) {
          console.log('Found element, scrolling...');
          setHighlightedNote(noteId);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Remove highlight after fade completes
          setTimeout(() => setHighlightedNote(null), 1000);
          return;
        } else if (attempts < 20) {
          // Retry every 100ms for up to 2 seconds
          setTimeout(() => tryScroll(attempts + 1), 100);
        } else {
          console.log('Failed to find element after 20 attempts');
        }
      };
      
      // Start with a delay to let the page settle
      setTimeout(() => tryScroll(), 100);
    }
  }, [noteId]);

  if (isPending || !record) return null;

  return (
    <div className="mt-2 mb-2 flex gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex">
              <Avatar />
              <div className="ml-2 flex-1">
                <h5 className="text-xl font-semibold">
                  {record.first_name} {record.last_name}
                </h5>
              </div>
            </div>
            <ReferenceManyField
              target="contact_id"
              reference="contactNotes"
              sort={{ field: "date", order: "DESC" }}
              perPage={1000}
              empty={
                <NoteCreate reference="contacts" showStatus className="mt-4" />
              }
            >
              <NotesIterator reference="contacts" showStatus highlightedNote={highlightedNote} />
            </ReferenceManyField>
          </CardContent>
        </Card>
      </div>
      <ContactAside />
    </div>
  );
};

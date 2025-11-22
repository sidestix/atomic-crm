import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { format } from "date-fns";

import { cn } from "@/lib/utils.ts";
import {
  TextInput,
  FileInput,
  FileField,
} from "@/components/admin";
import { Button } from "@/components/ui/button";

export const NoteInputs = ({ showStatus }: { showStatus?: boolean }) => {
  const { setValue } = useFormContext();
  const [displayMore, setDisplayMore] = useState(false);

  return (
    <div className="space-y-2">
      <TextInput
        source="text"
        label={false}
        multiline
        helperText={false}
        placeholder="Add a note"
      />

      {!displayMore && (
        <div className="flex justify-end items-center gap-2">
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              setDisplayMore(!displayMore);
            }}
            className="text-sm text-muted-foreground underline hover:no-underline p-0 h-auto cursor-pointer"
          >
            Show options
          </Button>
          <span className="text-sm text-muted-foreground">
            (attach files, or change details)
          </span>
        </div>
      )}

      <div
        className={cn(
          "space-y-3 mt-3 overflow-hidden transition-transform ease-in-out duration-300 origin-top",
          !displayMore ? "scale-y-0 max-h-0 h-0" : "scale-y-100",
        )}
      >
        <TextInput
          source="date"
          label="Date"
          helperText={false}
          type="datetime-local"
          className="text-primary"
          defaultValue={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
        />
        <FileInput source="attachments" multiple>
          <FileField source="src" title="title" target="_blank" />
        </FileInput>
      </div>
    </div>
  );
};

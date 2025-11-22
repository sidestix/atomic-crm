import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CircleX, Edit, Save, Trash2 } from "lucide-react";
import {
  Form,
  useDelete,
  useNotify,
  useResourceContext,
  useUpdate,
  WithRecord,
} from "ra-core";
import { useState } from "react";
import type { FieldValues, SubmitHandler } from "react-hook-form";

import { ReferenceField } from "@/components/admin";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { Avatar } from "../contacts/Avatar";
import { RelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import { SaleName } from "../sales/SaleName";
import type { ContactNote, DealNote } from "../types";
import { NoteAttachments } from "./NoteAttachments";
import { NoteInputs } from "./NoteInputs";

export const Note = ({
  showStatus,
  note,
  id,
  highlightedNote,
}: {
  showStatus?: boolean;
  note: DealNote | ContactNote;
  isLast: boolean;
  id?: string;
  highlightedNote?: string | null;
}) => {
  const [isHover, setHover] = useState(false);
  const [isEditing, setEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isBeingDeleted, setIsBeingDeleted] = useState(false);
  const resource = useResourceContext();
  const notify = useNotify();

  const [update, { isPending }] = useUpdate();

  const [deleteNote] = useDelete(
    resource,
    { id: note.id, previousData: note },
    {
      mutationMode: "pessimistic",
      onSuccess: () => {
        notify("Note deleted", { type: "info", undoable: false });
      },
    },
  );

  const handleDelete = () => {
    setIsBeingDeleted(true);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteInput === 'DELETE') {
      deleteNote();
      setShowDeleteDialog(false);
      setIsBeingDeleted(false);
      setDeleteInput('');
    }
  };

  const handleDeleteCancel = () => {
    setIsBeingDeleted(false);
    setShowDeleteDialog(false);
    setDeleteInput('');
  };

  const handleEnterEditMode = () => {
    setEditing(!isEditing);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setHover(false);
  };

  const handleNoteUpdate: SubmitHandler<FieldValues> = (values) => {
    update(
      resource,
      {
        id: note.id,
        data: {
          ...values,
          // Convert datetime-local format to ISO string (same as NoteCreate)
          date: values.date
            ? new Date(values.date).toISOString()
            : note.date,
        },
        previousData: note,
      },
      {
        onSuccess: () => {
          setEditing(false);
          setHover(false);
        },
      },
    );
  };


  const isHighlighted = highlightedNote === id;
  
  return (
    <>
    <div
      id={id ? `note-${id}` : undefined}
      className={isBeingDeleted ? 'bg-red-100 border-2 border-red-300 rounded-lg' : 
                isHighlighted ? 'bg-yellow-100 rounded-lg animate-pulse' : ''}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center space-x-4 w-full">
        {resource === "contactNote" ? (
          <Avatar width={20} height={20} />
        ) : (
          <ReferenceField source="company_id" reference="companies" link="show">
            <CompanyAvatar width={20} height={20} />
          </ReferenceField>
        )}
        <div className="inline-flex h-full items-center text-sm text-muted-foreground">
          <ReferenceField
            record={note}
            resource={resource}
            source="sales_id"
            reference="sales"
            link={false}
          >
            <WithRecord render={(record) => <SaleName sale={record} />} />
          </ReferenceField>{" "}
          added a note{" "}
          {showStatus && note.status && (
            <Status className="ml-2" status={note.status} />
          )}
        </div>
        <span className={`${isHover ? "visible" : "invisible"}`}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEnterEditMode}
                  className="p-1 h-auto cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit note</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="p-1 h-auto cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete note</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </span>
        <div className="flex-1"></div>
        <span className="text-sm text-muted-foreground">
          <RelativeDate date={note.date} />
        </span>
      </div>
      {isEditing ? (
        <Form onSubmit={handleNoteUpdate} record={note}>
          <NoteInputs showStatus={showStatus} />
          <div className="flex justify-end mt-4 space-x-4">
            <Button
              variant="ghost"
              onClick={handleCancelEdit}
              type="button"
              className="cursor-pointer"
            >
              <CircleX className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Update note
            </Button>
          </div>
        </Form>
      ) : (
        <div className="pt-2 [&_p:empty]:min-h-[0.75em]">
          {note.text?.split("\n").map((paragraph: string, index: number) => (
            <p className="text-sm leading-6 m-0" key={index}>
              {paragraph}
            </p>
          ))}

          {note.attachments && <NoteAttachments note={note} />}
        </div>
      )}
    </div>
    
    <DeleteConfirmationDialog
      open={showDeleteDialog}
      onOpenChange={setShowDeleteDialog}
      deleteInput={deleteInput}
      setDeleteInput={setDeleteInput}
      onConfirm={handleDeleteConfirm}
      onCancel={handleDeleteCancel}
    />
    </>
  );
};

// Delete Confirmation Dialog Component
const DeleteConfirmationDialog = ({ 
  open, 
  onOpenChange, 
  deleteInput, 
  setDeleteInput, 
  onConfirm, 
  onCancel 
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteInput: string;
  setDeleteInput: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete Note</DialogTitle>
        <DialogDescription>
          This action cannot be undone. Type <strong>DELETE</strong> to confirm.
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <Input
          placeholder="Type DELETE to confirm"
          value={deleteInput}
          onChange={(e) => setDeleteInput(e.target.value)}
          className="w-full"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={onConfirm}
          disabled={deleteInput !== 'DELETE'}
        >
          Delete Note
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

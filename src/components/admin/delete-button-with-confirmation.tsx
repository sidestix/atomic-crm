import * as React from "react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Trash } from "lucide-react";
import { humanize, singularize } from "inflection";
import {
  useDelete,
  useGetRecordRepresentation,
  useResourceTranslation,
  useRecordContext,
  useResourceContext,
  useTranslate,
  useNotify,
  useRedirect,
  type UseDeleteOptions,
  type RedirectionSideEffect,
} from "ra-core";
import { useState } from "react";

export type DeleteButtonWithConfirmationProps = {
  label?: string;
  size?: "default" | "sm" | "lg" | "icon";
  mutationOptions?: UseDeleteOptions;
  redirect?: RedirectionSideEffect;
  resource?: string;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
};

export const DeleteButtonWithConfirmation = (props: DeleteButtonWithConfirmationProps) => {
  const {
    label: labelProp,
    size,
    mutationOptions,
    redirect: redirectTo = "list",
    variant = "outline",
    className = "cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
  } = props;
  const record = useRecordContext(props);
  const resource = useResourceContext(props);
  const notify = useNotify();
  const redirect = useRedirect();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [deleteRecord, { isPending }] = useDelete(
    resource,
    { id: record?.id, previousData: record },
    {
      mutationMode: "pessimistic",
      onSuccess: () => {
        notify(`${resourceName} deleted`, { 
          type: "info",
          undoable: false 
        });
        // Convert redirect shorthand to actual path
        const redirectPath = redirectTo === "list" ? `/${resource}` : redirectTo;
        redirect(redirectPath);
      },
      onError: () => {
        notify("Failed to delete", { type: "error" });
      },
      ...mutationOptions,
    }
  );

  const translate = useTranslate();
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  let recordRepresentation = getRecordRepresentation(record);
  const resourceName = translate(`resources.${resource}.forcedCaseName`, {
    smart_count: 1,
    _: humanize(
      translate(`resources.${resource}.name`, {
        smart_count: 1,
        _: resource ? singularize(resource) : undefined,
      }),
      true,
    ),
  });

  // We don't support React elements for this
  if (React.isValidElement(recordRepresentation)) {
    recordRepresentation = `#${record?.id}`;
  }
  const label = useResourceTranslation({
    resourceI18nKey: `resources.${resource}.action.delete`,
    baseI18nKey: "ra.action.delete",
    options: {
      name: resourceName,
      recordRepresentation,
    },
    userText: labelProp,
  });

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    deleteRecord();
    setShowDeleteDialog(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Button
        variant={variant}
        type="button"
        onClick={handleDeleteClick}
        disabled={isPending}
        aria-label={typeof label === "string" ? label : undefined}
        size={size}
        className={className}
      >
        <Trash />
        {label}
      </Button>
      
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${resourceName}`}
        description={`Are you sure you want to delete this ${resourceName.toLowerCase()}? This action cannot be undone.`}
        resourceName={resourceName}
      />
    </>
  );
};
import {
  AutocompleteInput,
  ReferenceInput,
  TextInput,
  SelectInput,
  SaveButton,
  RadioButtonGroupInput,
} from "@/components/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Plus } from "lucide-react";
import {
  CreateBase,
  Form,
  RecordRepresentation,
  required,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useUpdate,
  type Identifier,
} from "ra-core";
import { useState, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { contactOptionText } from "../misc/ContactOption";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";

const TaskEntitySelector = () => {
  const form = useFormContext();
  const entityType = useWatch({ name: "_entity_type" }) || "contact";
  
  useEffect(() => {
    // Clear the other field when entity type changes
    if (entityType === "contact") {
      form.setValue("company_id", undefined);
    } else {
      form.setValue("contact_id", undefined);
    }
  }, [entityType, form]);

  return (
    <>
      <RadioButtonGroupInput
        source="_entity_type"
        label="Task Type"
        choices={[
          { id: "contact", name: "Contact Task" },
          { id: "company", name: "Company Task" },
        ]}
        defaultValue="contact"
        helperText={false}
      />
      {entityType === "contact" ? (
        <ReferenceInput
          source="contact_id"
          reference="contacts_summary"
        >
          <AutocompleteInput
            label="Contact"
            optionText={contactOptionText}
            helperText={false}
            validate={required()}
          />
        </ReferenceInput>
      ) : (
        <ReferenceInput
          source="company_id"
          reference="companies_summary"
        >
          <AutocompleteInput
            label="Company"
            optionText="name"
            helperText={false}
            validate={required()}
          />
        </ReferenceInput>
      )}
    </>
  );
};

export const AddTask = ({
  selectContact,
  display = "chip",
}: {
  selectContact?: boolean;
  display?: "chip" | "icon";
}) => {
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [update] = useUpdate();
  const notify = useNotify();
  const { taskTypes } = useConfigurationContext();
  const contact = useRecordContext<{ id?: Identifier }>();
  const company = useRecordContext<Company>();
  const [open, setOpen] = useState(false);
  
  const handleOpen = () => {
    setOpen(true);
  };

  const handleSuccess = async (data: any) => {
    setOpen(false);
    
    if (data.contact_id) {
      const contact = await dataProvider.getOne("contacts", {
        id: data.contact_id,
      });
      if (contact.data) {
        await update("contacts", {
          id: contact.data.id,
          data: { last_seen: new Date().toISOString() },
          previousData: contact.data,
        });
      }
    }

    notify("Task added");
  };

  if (!identity) return null;

  return (
    <>
      {display === "icon" ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="p-2 cursor-pointer"
                onClick={handleOpen}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Create task</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <div className="my-2">
          <Button
            variant="outline"
            className="h-6 cursor-pointer"
            onClick={handleOpen}
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Add task
          </Button>
        </div>
      )}

      <CreateBase
        resource="tasks"
        record={{
          type: "None",
          // Only set the ID for the context we're actually in
          // If company exists, use it; otherwise use contact (but not both)
          contact_id: !selectContact && !company?.id ? contact?.id : undefined,
          company_id: !selectContact && company?.id ? company?.id : undefined,
          due_date: new Date().toISOString().slice(0, 10),
          sales_id: identity.id,
        }}
        transform={(data) => {
          const dueDate = new Date(data.due_date);
          dueDate.setHours(0, 0, 0, 0);
          data.due_date = dueDate.toISOString();
          
          // Remove the virtual _entity_type field
          delete data._entity_type;
          
          // Ensure only one ID is set
          if (data.contact_id) {
            delete data.company_id;
          } else if (data.company_id) {
            delete data.contact_id;
          }
          
          return {
            ...data,
            due_date: new Date(data.due_date).toISOString(),
          };
        }}
        mutationOptions={{ onSuccess: handleSuccess }}
      >
        <Dialog open={open} onOpenChange={() => setOpen(false)}>
          <DialogContent className="lg:max-w-xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
            <Form className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>
                  {!selectContact
                    ? `Create a new task for ${contact ? "contact" : company ? "company" : ""}`
                    : "Create a new task"}
                  {!selectContact && contact?.id && (
                    <RecordRepresentation
                      record={contact as { id: Identifier }}
                      resource="contacts"
                    />
                  )}
                  {!selectContact && company?.id && (
                    <RecordRepresentation
                      record={company}
                      resource="companies"
                    />
                  )}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <TextInput
                  autoFocus
                  source="text"
                  label="Description"
                  validate={required()}
                  multiline
                  className="m-0"
                  helperText={false}
                />
                {selectContact && (
                  <TaskEntitySelector />
                )}

                <div className="flex flex-row gap-4">
                  <TextInput
                    source="due_date"
                    helperText={false}
                    type="date"
                    validate={required()}
                  />
                  <SelectInput
                    source="type"
                    validate={required()}
                    choices={taskTypes.map((type) => ({
                      id: type,
                      name: type,
                    }))}
                    helperText={false}
                  />
                </div>
              </div>
              <DialogFooter className="w-full justify-end">
                <SaveButton />
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </CreateBase>
    </>
  );
};

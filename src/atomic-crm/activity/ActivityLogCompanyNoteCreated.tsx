import { ReferenceField, TextField } from "@/components/admin";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { RelativeDate } from "../misc/RelativeDate";
import { SaleName } from "../sales/SaleName";
import type { ActivityCompanyNoteCreated } from "../types";
import { useActivityLogContext } from "./ActivityLogContext";
import { ActivityLogNote } from "./ActivityLogNote";

type ActivityLogCompanyNoteCreatedProps = {
  activity: ActivityCompanyNoteCreated;
};

export function ActivityLogCompanyNoteCreated({
  activity,
}: ActivityLogCompanyNoteCreatedProps) {
  const context = useActivityLogContext();
  const { companyNote } = activity;
  return (
    <ActivityLogNote
      header={
        <div className="flex items-center gap-2 w-full">
          <ReferenceField
            source="company_id"
            reference="companies"
            record={activity.companyNote}
          >
            <CompanyAvatar width={20} height={20} />
          </ReferenceField>

          <div className="flex flex-row flex-grow">
            <div className="text-sm text-muted-foreground flex-grow">
              <span className="text-muted-foreground text-sm inline-flex">
                <ReferenceField
                  source="sales_id"
                  reference="sales"
                  record={activity}
                >
                  <SaleName />
                </ReferenceField>
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  record={activity.companyNote}
                >
                  &nbsp;added a note about <TextField source="name" />
                </ReferenceField>
              </span>
            </div>

            {context === "company" && (
              <span className="text-muted-foreground text-sm">
                <RelativeDate date={activity.date} />
              </span>
            )}
          </div>
        </div>
      }
      text={companyNote.text}
    />
  );
}


import {
  CancelButton,
  SaveButton,
  FormToolbar as KitFormToolbar,
} from "@/components/admin";
import { DeleteButtonWithConfirmation } from "@/components/admin/delete-button-with-confirmation";

export const FormToolbar = () => (
  <KitFormToolbar className="flex md:flex flex-row justify-between gap-2">
    <DeleteButtonWithConfirmation />

    <div className="flex flex-row gap-2 justify-end">
      <CancelButton />
      <SaveButton />
    </div>
  </KitFormToolbar>
);

import { useCreate } from "ra-core";
import type { ManualDiscount } from "../types";
import { TagDialog } from "../tags/TagDialog";

type ManualDiscountCreateModalProps = {
  open: boolean;
  onClose(): void;
  onSuccess?(manualDiscount: ManualDiscount): Promise<void>;
};

export function ManualDiscountCreateModal({
  open,
  onClose,
  onSuccess,
}: ManualDiscountCreateModalProps) {
  const [create] = useCreate<ManualDiscount>();

  const handleCreateManualDiscount = async (data: Pick<ManualDiscount, "name" | "color">) => {
    await create(
      "manual_discounts",
      { data },
      {
        onSuccess: async (manualDiscount) => {
          await onSuccess?.(manualDiscount);
        },
      },
    );
  };

  return (
    <TagDialog
      open={open}
      title="Create a new manual discount"
      onClose={onClose}
      onSubmit={handleCreateManualDiscount}
    />
  );
}


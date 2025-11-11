import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Plus } from "lucide-react";
import type { Identifier } from "ra-core";
import { useGetList, useGetMany, useRecordContext, useUpdate } from "ra-core";
import * as React from "react";
import { useState } from "react";

import { TagChip } from "../tags/TagChip";
import type { Contact, ManualDiscount } from "../types";
import { ManualDiscountCreateModal } from "./ManualDiscountCreateModal";

export const ManualDiscountsListEdit = () => {
  const record = useRecordContext<Contact>();
  const [open, setOpen] = useState(false);

  const { data: allManualDiscounts, isPending: isPendingAllManualDiscounts } = useGetList<ManualDiscount>(
    "manual_discounts",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "name", order: "ASC" },
    },
  );
  const { data: manualDiscounts, isPending: isPendingRecordManualDiscounts } = useGetMany<ManualDiscount>(
    "manual_discounts",
    { ids: record?.manual_discount_ids },
    { enabled: record && record.manual_discount_ids && record.manual_discount_ids.length > 0 },
  );
  const [update] = useUpdate<Contact>();

  const unselectedManualDiscounts =
    allManualDiscounts && record && allManualDiscounts.filter((md) => !(record.manual_discount_ids || []).includes(md.id));

  const handleManualDiscountAdd = (id: Identifier) => {
    if (!record) {
      throw new Error("No contact record found");
    }
    const manualDiscounts = [...(record.manual_discount_ids || []), id];
    update("contacts", {
      id: record.id,
      data: { manual_discount_ids: manualDiscounts },
      previousData: record,
    });
  };

  const handleManualDiscountDelete = async (id: Identifier) => {
    if (!record) {
      throw new Error("No contact record found");
    }
    const manualDiscounts = (record.manual_discount_ids || []).filter((mdId) => mdId !== id);
    await update("contacts", {
      id: record.id,
      data: { manual_discount_ids: manualDiscounts },
      previousData: record,
    });
  };

  const openManualDiscountCreateDialog = () => {
    setOpen(true);
  };

  const handleManualDiscountCreateClose = () => {
    setOpen(false);
  };

  const handleManualDiscountCreated = React.useCallback(
    async (manualDiscount: ManualDiscount) => {
      if (!record) {
        throw new Error("No contact record found");
      }

      await update(
        "contacts",
        {
          id: record.id,
          data: { manual_discount_ids: [...(record.manual_discount_ids || []), manualDiscount.id] },
          previousData: record,
        },
        {
          onSuccess: () => {
            setOpen(false);
          },
        },
      );
    },
    [update, record],
  );

  if (isPendingRecordManualDiscounts || isPendingAllManualDiscounts) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {manualDiscounts?.map((manualDiscount) => (
        <div key={manualDiscount.id}>
          <TagChip tag={manualDiscount} onUnlink={() => handleManualDiscountDelete(manualDiscount.id)} />
        </div>
      ))}

      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 cursor-pointer">
              <Plus className="h-3 w-3 mr-1" />
              Add discount
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {unselectedManualDiscounts?.map((manualDiscount) => (
              <DropdownMenuItem
                key={manualDiscount.id}
                onClick={() => handleManualDiscountAdd(manualDiscount.id)}
              >
                <Badge
                  variant="secondary"
                  className="text-xs font-normal text-black"
                  style={{
                    backgroundColor: manualDiscount.color,
                  }}
                >
                  {manualDiscount.name}
                </Badge>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={openManualDiscountCreateDialog}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start p-0 cursor-pointer"
              >
                <Edit className="h-3 w-3 mr-2" />
                Create new discount
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ManualDiscountCreateModal
        open={open}
        onClose={handleManualDiscountCreateClose}
        onSuccess={handleManualDiscountCreated}
      />
    </div>
  );
};


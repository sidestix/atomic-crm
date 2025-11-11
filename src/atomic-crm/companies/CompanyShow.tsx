import {
  ShowBase,
  useListContext,
  useShowContext,
} from "ra-core";
import {
  Link as RouterLink,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReferenceManyField } from "@/components/admin";

import { ActivityLog } from "../activity/ActivityLog";
import { findDealLabel } from "../deals/deal";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Deal } from "../types";
import { CompanyAside } from "./CompanyAside";
import { CompanyAvatar } from "./CompanyAvatar";

export const CompanyShow = () => (
  <ShowBase>
    <CompanyShowContent />
  </ShowBase>
);

const CompanyShowContent = () => {
  const { record, isPending } = useShowContext<Company>();
  const navigate = useNavigate();

  // Get tab from URL or default to "activity"
  const tabMatch = useMatch("/companies/:id/show/:tab");
  const currentTab = tabMatch?.params?.tab || "activity";

  const handleTabChange = (value: string) => {
    if (value === currentTab) return;
    if (value === "activity") {
      navigate(`/companies/${record?.id}/show`);
      return;
    }
    navigate(`/companies/${record?.id}/show/${value}`);
  };

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
            <Tabs defaultValue={currentTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="activity">Activity</TabsTrigger>
                {record.nb_deals ? (
                  <TabsTrigger value="deals">
                    {record.nb_deals === 1
                      ? "1 deal"
                      : `${record.nb_deals} deals`}
                  </TabsTrigger>
                ) : null}
              </TabsList>
              <TabsContent value="activity" className="pt-2">
                <ActivityLog companyId={record.id} context="company" />
              </TabsContent>
              <TabsContent value="deals">
                {record.nb_deals ? (
                  <ReferenceManyField
                    reference="deals"
                    target="company_id"
                    sort={{ field: "name", order: "ASC" }}
                  >
                    <DealsIterator />
                  </ReferenceManyField>
                ) : null}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <CompanyAside />
    </div>
  );
};

const DealsIterator = () => {
  const { data: deals, error, isPending } = useListContext<Deal>();
  const { dealStages } = useConfigurationContext();
  if (isPending || error) return null;

  const now = Date.now();
  return (
    <div>
      <div>
        {deals.map((deal) => (
          <div key={deal.id} className="p-0 text-sm">
            <RouterLink
              to={`/deals/${deal.id}/show`}
              className="flex items-center justify-between hover:bg-muted py-2 px-4 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{deal.name}</div>
                <div className="text-sm text-muted-foreground">
                  {findDealLabel(dealStages, deal.stage)},{" "}
                  {deal.amount.toLocaleString("en-US", {
                    notation: "compact",
                    style: "currency",
                    currency: "USD",
                    currencyDisplay: "narrowSymbol",
                    minimumSignificantDigits: 3,
                  })}
                  {deal.category ? `, ${deal.category}` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  last activity {formatDistance(deal.updated_at, now)} ago{" "}
                </div>
              </div>
            </RouterLink>
          </div>
        ))}
      </div>
    </div>
  );
};

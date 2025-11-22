/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { ContactGender, DealStage, NoteStatus } from "../types";
import {
  defaultCompanySectors,
  defaultContactGender,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";

// Define types for the context value
export interface ConfigurationContextValue {
  companySectors: string[];
  dealCategories: string[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskTypes: string[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  contactGender: ContactGender[];
  enableDeals: boolean;
}

export interface ConfigurationProviderProps
  extends Partial<ConfigurationContextValue> {
  children: ReactNode;
}

// Create context with default value
export const ConfigurationContext = createContext<ConfigurationContextValue>({
  companySectors: defaultCompanySectors,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
  contactGender: defaultContactGender,
  enableDeals: true,
});

export const ConfigurationProvider = ({
  children,
  companySectors,
  dealCategories,
  dealPipelineStatuses,
  dealStages,
  darkModeLogo,
  lightModeLogo,
  noteStatuses,
  taskTypes,
  title,
  contactGender,
  enableDeals = true,
}: ConfigurationProviderProps) => (
  <ConfigurationContext.Provider
    value={{
      companySectors,
      dealCategories,
      dealPipelineStatuses,
      dealStages,
      darkModeLogo,
      lightModeLogo,
      noteStatuses,
      title,
      taskTypes,
      contactGender,
      enableDeals,
    }}
  >
    {children}
  </ConfigurationContext.Provider>
);

export const useConfigurationContext = () => useContext(ConfigurationContext);
